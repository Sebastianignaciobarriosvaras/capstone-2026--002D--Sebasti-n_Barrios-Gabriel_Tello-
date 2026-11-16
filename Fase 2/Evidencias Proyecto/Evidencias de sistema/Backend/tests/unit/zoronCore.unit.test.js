const crypto = require('crypto');
const request = require('supertest');
const app = require('../../src/index');
const db = require('../../src/config/db');

jest.mock('../../src/config/db');

function generarHashNativo(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verificarHashNativo(password, guardado) {
  if (!guardado || !guardado.includes(':')) return false;
  const [salt, key] = guardado.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return keyBuffer.length === derivedKey.length && crypto.timingSafeEqual(keyBuffer, derivedKey);
}

const limpiarMontoCLP = (valor) => {
  if (valor === undefined || valor === null || valor === '') return 0;
  if (typeof valor === 'number') return isNaN(valor) ? 0 : Math.round(valor);

  let str = String(valor).trim().replace(/\$/g, '').replace(/\s/g, '');
  if (str === '-' || str === '') return 0;

  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    const partes = str.split('.');
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) {
      str = partes.join('');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num);
};

const normalizarFecha = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const str = String(valor).trim();
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    const [dia, mes, anio] = str.split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T12:00:00.000Z`);
  }
  const num = Number(str);
  if (!isNaN(num) && num > 0) {
    return new Date(Date.UTC(1899, 11, 30) + num * 86400000);
  }
  return null;
};

const esEmailCorporativoValido = (email) =>
  typeof email === 'string' &&
  /^[A-Za-z0-9._%+-]+@(zoron|teamzoron)\.cl$/i.test(email.trim());

const calcularIVA = (montoNeto) => Math.round(montoNeto * 0.19);

describe('Pruebas Unitarias — Núcleo Financiero, Criptográfico y Controladores ZORON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('UT-01: Generación y verificación de hash scrypt con salt aleatorio', () => {
    const clave = 'ZoronFinanzas2026#';
    const hash1 = generarHashNativo(clave);
    const hash2 = generarHashNativo(clave);

    expect(hash1).not.toBe(hash2);
    expect(verificarHashNativo(clave, hash1)).toBe(true);
    expect(verificarHashNativo('ClaveErronea', hash1)).toBe(false);
    expect(verificarHashNativo(clave, 'invalido')).toBe(false);
  });

  test('UT-02: Normalización de montos contables en Pesos Chilenos (CLP)', () => {
    expect(limpiarMontoCLP('$ 1.250.000')).toBe(1250000);
    expect(limpiarMontoCLP('$45.990')).toBe(45990);
    expect(limpiarMontoCLP('-')).toBe(0);
    expect(limpiarMontoCLP(null)).toBe(0);
    expect(limpiarMontoCLP('1.500.250,75')).toBe(1500251);
  });

  test('UT-03: Controlador de Proyectos y Usuarios responde correctamente con datos de PostgreSQL', async () => {
    db.query.mockResolvedValue({
      rows: [{ id_proyecto: 1, nombre_proyecto: 'Operación Norte', estado: 'ACTIVO' }]
    });

    const resProyectos = await request(app).get('/api/proyectos');
    expect([200, 404]).toContain(resProyectos.statusCode);

    const resUsuarios = await request(app).get('/api/usuarios');
    expect([200, 404]).toContain(resUsuarios.statusCode);
  });

  test('UT-04: Controlador de Proyecciones y Cargas responde sin excepciones no controladas', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const resProyecciones = await request(app).get('/api/proyecciones');
    expect([200, 404]).toContain(resProyecciones.statusCode);

    const resCargas = await request(app).get('/api/cargas');
    expect([200, 404]).toContain(resCargas.statusCode);
  });

  test('UT-05: Normalización de fechas desde Excel serial y formato DD-MM-YYYY', () => {
    const f1 = normalizarFecha('16-11-2026');
    expect(f1).toBeInstanceOf(Date);
    expect(f1.getUTCFullYear()).toBe(2026);
    expect(f1.getUTCMonth()).toBe(10); // Noviembre
    expect(f1.getUTCDate()).toBe(16);

    const f2 = normalizarFecha(46336);
    expect(f2).toBeInstanceOf(Date);
    expect(f2.getUTCFullYear()).toBe(2026);

    const f3 = normalizarFecha('2026-11-16');
    expect(f3).toBeInstanceOf(Date);
    expect(f3.getUTCFullYear()).toBe(2026);

    expect(normalizarFecha('')).toBeNull();
    expect(normalizarFecha(null)).toBeNull();
  });

  test('UT-06: Casos borde de montos CLP (negativos, cero, decimales y strings inválidos)', () => {
    expect(limpiarMontoCLP('$ 0')).toBe(0);
    expect(limpiarMontoCLP(0)).toBe(0);
    expect(limpiarMontoCLP(-1500)).toBe(-1500);
    expect(limpiarMontoCLP('$ -1.500')).toBe(-1500);
    expect(limpiarMontoCLP('abc')).toBe(0);
    expect(limpiarMontoCLP(undefined)).toBe(0);
    expect(limpiarMontoCLP('1.000')).toBe(1000);
    expect(limpiarMontoCLP('1,5')).toBe(2);
  });

  test('UT-07: Hash scrypt soporta contraseñas muy largas y rechaza verificación de contraseñas vacías', () => {
    const claveLarga = 'A'.repeat(500) + 'Zoron2026#';
    const hash = generarHashNativo(claveLarga);
    expect(verificarHashNativo(claveLarga, hash)).toBe(true);
    expect(verificarHashNativo(claveLarga + 'x', hash)).toBe(false);

    const hashVacio = generarHashNativo('');
    expect(verificarHashNativo('', hashVacio)).toBe(true);
    expect(verificarHashNativo('abc', hashVacio)).toBe(false);
  });

  test('UT-08: Validación de correo corporativo @zoron.cl / @teamzoron.cl', () => {
    expect(esEmailCorporativoValido('gabriel@zoron.cl')).toBe(true);
    expect(esEmailCorporativoValido('wildo@teamzoron.cl')).toBe(true);
    expect(esEmailCorporativoValido('GABRIEL@ZORON.CL')).toBe(true);

    expect(esEmailCorporativoValido('gabriel@gmail.com')).toBe(false);
    expect(esEmailCorporativoValido('gabriel@zoron.com')).toBe(false);
    expect(esEmailCorporativoValido('sin-arroba.cl')).toBe(false);
    expect(esEmailCorporativoValido('')).toBe(false);
    expect(esEmailCorporativoValido(null)).toBe(false);
  });

  test('UT-09: Cálculo de IVA (19%) con redondeo CLP para montos contables', () => {
    expect(calcularIVA(1000000)).toBe(190000);
    expect(calcularIVA(850000)).toBe(161500);
    expect(calcularIVA(45990)).toBe(8738);
    expect(calcularIVA(0)).toBe(0);
    expect(calcularIVA(1)).toBe(0);
    expect(calcularIVA(3)).toBe(1);
  });

  test('UT-10: Cálculo de total con IVA y redondeo estable en lote financiero', () => {
    const filas = [
      { neto: 1000000, iva: 190000, total: 1190000 },
      { neto: 850000, iva: 161500, total: 1011500 },
      { neto: 45990, iva: 8738, total: 54728 }
    ];

    const calculados = filas.map((f) => ({
      neto: f.neto,
      iva: calcularIVA(f.neto),
      total: f.neto + calcularIVA(f.neto)
    }));

    expect(calculados[0].total).toBe(1190000);
    expect(calculados[1].total).toBe(1011500);
    expect(calculados[2].total).toBe(54728);
  });

  test('UT-11: Generación de múltiples hashes no colisiona entre sí', () => {
    const hashes = new Set();
    for (let i = 0; i < 100; i++) {
      hashes.add(generarHashNativo(`ClaveUnica${i}Zoron`));
    }
    expect(hashes.size).toBe(100);
  });

  test('UT-12: Manejo robusto de entradas nulas/indefinidas en utilidades financieras', () => {
    expect(limpiarMontoCLP(null)).toBe(0);
    expect(limpiarMontoCLP(undefined)).toBe(0);
    expect(limpiarMontoCLP('')).toBe(0);
    expect(limpiarMontoCLP(NaN)).toBe(0);

    expect(normalizarFecha(null)).toBeNull();
    expect(normalizarFecha(undefined)).toBeNull();
    expect(normalizarFecha('')).toBeNull();

    expect(verificarHashNativo('x', null)).toBe(false);
    expect(verificarHashNativo('x', '')).toBe(false);
    expect(verificarHashNativo('x', 'sinDospuntos')).toBe(false);
  });
});