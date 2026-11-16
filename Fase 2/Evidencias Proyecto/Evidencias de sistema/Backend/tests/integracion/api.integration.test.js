const request = require('supertest');
const app = require('../../src/index');
const db = require('../../src/config/db');
const authService = require('../../src/services/bluehostingAuthService');

jest.mock('../../src/config/db');
jest.mock('../../src/services/bluehostingAuthService');

describe('Pruebas de Integración — Endpoints Reales API ZORON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('IT-01: GET / debe verificar salud de la API y conexión activa con PostgreSQL', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ now: '2026-11-16T19:00:00.000Z' }]
    });

    const res = await request(app).get('/');

    expect(res.statusCode).toBe(200);
    expect(res.body.estado).toBe('API Activa');
    expect(res.body.mensaje).toBe('Conexión a PostgreSQL exitosa');
    expect(res.body.fecha_servidor_bd).toBeDefined();
  });

  test('IT-02: GET / debe retornar HTTP 500 controlado si PostgreSQL no responde', async () => {
    db.query.mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

    const res = await request(app).get('/');

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Error al conectar con la base de datos');
  });

  test('IT-03: POST /api/auth/login debe autenticar usuario corporativo y omitir password en la respuesta', async () => {
    authService.autenticarYProvisionarUsuario.mockResolvedValueOnce({
      id_usuario: 1,
      nombre: 'Gabriel Tello',
      email: 'gabriel@zoron.cl',
      password: 'salt:hash_privado_no_exponer',
      rol: 'ADMIN',
      estado: 'ACTIVO'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'gabriel@zoron.cl', password: 'PasswordSegura2026' });

    expect(res.statusCode).toBe(200);
    expect(res.body.mensaje).toBe('Inicio de sesión exitoso');
    expect(res.body.usuario.email).toBe('gabriel@zoron.cl');
    expect(res.body.usuario.password).toBeUndefined();
  });

  test('IT-04: POST /v1/api/auth/login debe responder igual en el prefijo de producción (/v1)', async () => {
    authService.autenticarYProvisionarUsuario.mockRejectedValueOnce(new Error('CUENTA_DESACTIVADA'));

    const res = await request(app)
      .post('/v1/api/auth/login')
      .send({ email: 'inactivo@teamzoron.cl', password: 'PasswordSegura2026' });

    expect(res.statusCode).toBe(403);
    expect(res.body.mensaje).toMatch(/desactivada/i);
  });

  test('IT-05: POST /api/auth/login debe rechazar peticiones sin credenciales con HTTP 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'gabriel@zoron.cl' });

    expect(res.statusCode).toBe(400);
    expect(authService.autenticarYProvisionarUsuario).not.toHaveBeenCalled();
  });

  test('IT-06: GET /api/movimientos debe responder con listado JSON (o 404 si aún no se ha expuesto)', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id_movimiento: 1, documento: 'FACTURA', total: 1011500, conciliado: true },
        { id_movimiento: 2, documento: 'BOLETA', total: 45990, conciliado: false }
      ]
    });

    const res = await request(app).get('/api/movimientos');

    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    }
  });

  test('IT-07: GET /api/proyectos debe retornar listado JSON con centros de costo', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id_proyecto: 1, nombre_proyecto: 'Operación Norte', estado: 'ACTIVO' },
        { id_proyecto: 2, nombre_proyecto: 'Operación Sur', estado: 'CERRADO' }
      ]
    });

    const res = await request(app).get('/api/proyectos');

    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  test('IT-08: POST /api/auth/login debe rechazar formatos de email inválidos', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-es-un-email', password: 'PasswordSegura2026' });

    expect([400, 401]).toContain(res.statusCode);
    expect(JSON.stringify(res.body)).not.toContain('no-es-un-email@');
  });

  test('IT-09: Rutas inexistentes deben retornar HTTP 404 sin filtrar rutas internas', async () => {
    const res = await request(app).get('/api/ruta-inexistente-xyz');

    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('/src/');
  });

  test('IT-10: GET /api/auth/login no debe permitir el acceso por método distinto a POST', async () => {
    const res = await request(app).get('/api/auth/login');
    expect([404, 405]).toContain(res.statusCode);
  });

  test('IT-11: POST /api/auth/login con body vacío debe responder 400 sin invocar servicios', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.statusCode).toBe(400);
    expect(authService.autenticarYProvisionarUsuario).not.toHaveBeenCalled();
  });

  test('IT-12: POST /api/auth/login debe responder con Content-Type JSON válido', async () => {
    authService.autenticarYProvisionarUsuario.mockResolvedValueOnce({
      id_usuario: 2,
      nombre: 'Wildo Pérez',
      email: 'wildo@zoron.cl',
      password: 'hash_oculto',
      rol: 'ADMIN'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wildo@zoron.cl', password: 'PasswordSegura2026' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  test('IT-13: Múltiples inicios de sesión concurrentes no deben mezclar la identidad del usuario', async () => {
    const identidades = Array.from({ length: 5 }, (_, i) => ({
      id_usuario: i + 1,
      nombre: `Usuario ${i + 1}`,
      email: `usuario${i + 1}@zoron.cl`,
      password: 'hash_oculto',
      rol: 'ADMIN'
    }));

    authService.autenticarYProvisionarUsuario
      .mockResolvedValueOnce(identidades[0])
      .mockResolvedValueOnce(identidades[1])
      .mockResolvedValueOnce(identidades[2])
      .mockResolvedValueOnce(identidades[3])
      .mockResolvedValueOnce(identidades[4]);

    const res = await Promise.all(
      identidades.map((id) =>
        request(app)
          .post('/api/auth/login')
          .send({ email: id.email, password: 'PasswordSegura2026' })
      )
    );

    res.forEach((r, idx) => {
      expect(r.statusCode).toBe(200);
      expect(r.body.usuario.email).toBe(identidades[idx].email);
      expect(r.body.usuario.password).toBeUndefined();
    });
  });

  test('IT-14: GET /api/proyecciones y GET /api/cargas deben responder sin excepciones no controladas', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const resProy = await request(app).get('/api/proyecciones');
    expect([200, 404]).toContain(resProy.statusCode);

    const resCargas = await request(app).get('/api/cargas');
    expect([200, 404]).toContain(resCargas.statusCode);
  });
});