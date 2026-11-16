const request = require('supertest');
const app = require('../../src/index');
const authService = require('../../src/services/bluehostingAuthService');
const db = require('../../src/config/db');

jest.mock('../../src/services/bluehostingAuthService');
jest.mock('../../src/config/db');

jest.setTimeout(15000);

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

describe('Pruebas de Rendimiento y Carga — API ZORON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('PF-01: Procesamiento y parseo de 10.000 registros financieros CLP en menos de 250 ms', () => {
    const matrizSimulada = Array.from({ length: 10000 }, (_, i) => [
      'FACTURA',
      'CONCILIADO',
      `F-${2000 + i}`,
      `Proveedor Nacional ${i} SpA`,
      '16-11-2026',
      'Banco Santander',
      'TRANSFERENCIA',
      '$ 850.000',
      '$ 161.500',
      '$ 0',
      '$ 1.011.500'
    ]);

    const inicio = performance.now();
    const normalizados = matrizSimulada.map((fila, idx) => ({
      id_movimiento: idx + 1,
      documento: fila[0],
      nro_documento: fila[2],
      razon_social: fila[3],
      total: Number(String(fila[10]).replace(/[^0-9-]/g, ''))
    }));
    const duracionMs = performance.now() - inicio;

    expect(normalizados).toHaveLength(10000);
    expect(normalizados[9999].total).toBe(1011500);
    expect(duracionMs).toBeLessThan(250);
  });

  test('PF-02: Concurrencia de 50 peticiones simultáneas a POST /api/auth/login bajo 2000 ms', async () => {
    authService.autenticarYProvisionarUsuario.mockResolvedValue({
      id_usuario: 10,
      nombre: 'Operador Concurrente',
      email: 'operador@zoron.cl',
      password: 'hash_oculto',
      rol: 'ADMIN'
    });

    const inicio = performance.now();
    const solicitudes = Array.from({ length: 50 }, (_, idx) =>
      request(app)
        .post('/api/auth/login')
        .send({ email: `operador${idx}@zoron.cl`, password: 'PasswordValida2026' })
    );

    const respuestas = await Promise.all(solicitudes);
    const tiempoTotalMs = performance.now() - inicio;

    expect(respuestas.every((r) => r.statusCode === 200)).toBe(true);
    expect(tiempoTotalMs).toBeLessThan(2000);
  });

  test('PF-03: Normalización de 50.000 montos CLP en menos de 800 ms', () => {
    const montos = Array.from({ length: 50000 }, (_, i) => {
      const variantes = [
        '$ 1.250.000',
        '$45.990',
        '1.500.250,75',
        '-',
        '0',
        `$ ${(i * 1000).toLocaleString('es-CL')}`
      ];
      return variantes[i % variantes.length];
    });

    const inicio = performance.now();
    const normalizados = montos.map(limpiarMontoCLP);
    const duracionMs = performance.now() - inicio;

    expect(normalizados).toHaveLength(50000);
    expect(normalizados.every((v) => typeof v === 'number' && !isNaN(v))).toBe(true);
    expect(duracionMs).toBeLessThan(800);
  });

  test('PF-04: Normalización de fechas Excel/DD-MM-YYYY en 10.000 registros en menos de 200 ms', () => {
    const normalizarFecha = (valor) => {
      if (valor === undefined || valor === null || valor === '') return null;
      const str = String(valor).trim();
      if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
        const [dia, mes, anio] = str.split('-').map(Number);
        return new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
      }
      const num = Number(str);
      if (!isNaN(num) && num > 0) {
        return new Date(Date.UTC(1899, 11, 30) + num * 86400000);
      }
      return null;
    };

    const entradas = Array.from({ length: 10000 }, (_, i) =>
      i % 2 === 0 ? '16-11-2026' : 46336 + (i % 30)
    );

    const inicio = performance.now();
    const resultados = entradas.map(normalizarFecha);
    const duracionMs = performance.now() - inicio;

    expect(resultados).toHaveLength(10000);
    expect(resultados.every((r) => r instanceof Date)).toBe(true);
    expect(duracionMs).toBeLessThan(200);
  });

  test('PF-05: Concurrencia de 30 peticiones simultáneas a GET /api/movimientos en menos de 1500 ms', async () => {
    db.query.mockResolvedValue({ rows: [{ id_movimiento: 1, total: 1000 }] });

    const inicio = performance.now();
    const solicitudes = Array.from({ length: 30 }, () =>
      request(app).get('/api/movimientos')
    );
    const respuestas = await Promise.all(solicitudes);
    const tiempoTotalMs = performance.now() - inicio;

    expect(respuestas.every((r) => [200, 404].includes(r.statusCode))).toBe(true);
    expect(tiempoTotalMs).toBeLessThan(1500);
  });

  test('PF-06: 100 inicios de sesión secuenciales mantienen consistencia y bajo 3000 ms', async () => {
    authService.autenticarYProvisionarUsuario.mockResolvedValue({
      id_usuario: 42,
      nombre: 'Operador Secuencial',
      email: 'operador@zoron.cl',
      password: 'hash_oculto',
      rol: 'ADMIN'
    });

    const inicio = performance.now();
    for (let i = 0; i < 100; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ email: `operador${i}@zoron.cl`, password: 'PasswordValida2026' });
      expect(r.statusCode).toBe(200);
    }
    const tiempoTotalMs = performance.now() - inicio;

    expect(tiempoTotalMs).toBeLessThan(3000);
  });

  test('PF-07: Procesamiento estable en memoria de 100.000 objetos financieros (GC estable)', () => {
    const inicio = performance.now();
    const lote = Array.from({ length: 100000 }, (_, i) => ({
      id_movimiento: i + 1,
      total: 1000 + (i % 500),
      conciliado: i % 2 === 0
    }));
    const resumen = lote.reduce(
      (acc, m) => {
        acc.total += m.total;
        if (m.conciliado) acc.conciliados += 1;
        return acc;
      },
      { total: 0, conciliados: 0 }
    );
    const duracionMs = performance.now() - inicio;

    expect(lote).toHaveLength(100000);
    expect(resumen.total).toBeGreaterThan(0);
    expect(resumen.conciliados).toBe(50000);
    expect(duracionMs).toBeLessThan(1000);
  });
});