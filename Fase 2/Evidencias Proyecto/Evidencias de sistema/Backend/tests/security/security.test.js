const request = require('supertest');
const app = require('../../src/index');
const db = require('../../src/config/db');
const authService = require('../../src/services/bluehostingAuthService');

jest.mock('../../src/config/db');
jest.mock('../../src/services/bluehostingAuthService');

describe('Pruebas de Seguridad — CORS, SQL Injection, IMAP Injection y Hardening en ZORON', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('SC-01: CORS debe permitir https://teamzoron.cl y https://zoron.cl, y bloquear orígenes externos', async () => {
    const resPermitido = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://teamzoron.cl')
      .set('Access-Control-Request-Method', 'POST');

    expect(resPermitido.headers['access-control-allow-origin']).toBe('https://teamzoron.cl');

    const resBloqueado = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://dominio-no-autorizado.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(resBloqueado.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('SC-02: Debe neutralizar payloads de SQL Injection sin concatenación ni errores 500 de sintaxis SQL', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const payloadMalicioso = "admin@zoron.cl' OR '1'='1' --";
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: payloadMalicioso, password: 'Password123' });

    for (const llamada of db.query.mock.calls) {
      const sql = llamada[0];
      expect(sql).not.toContain("OR '1'='1'");
      if (llamada[1]) {
        expect(sql).toContain('$1');
      }
    }

    expect(res.statusCode).toBe(401);
  });

  test('SC-03: Debe rechazar caracteres de control CRLF (\\r\\n) en credenciales IMAP', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'usuario@zoron.cl',
        password: 'clave\r\na2 SELECT INBOX\r\na3 LOGOUT'
      });

    expect(res.statusCode).toBe(401);
  });

  test('SC-04: Payloads XSS en el email no deben reflejarse sin escapar en la respuesta JSON', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const xssPayload = '<script>alert("XSS")</script>@zoron.cl';
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: xssPayload, password: 'Password123' });

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/<script>/i);
    expect(bodyStr).not.toMatch(/javascript:/i);
  });

  test('SC-05: Debe rechazar intentos de bypass de autenticación al omitir la contraseña', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@zoron.cl' });

    expect(res.statusCode).toBe(400);
    expect(authService.autenticarYProvisionarUsuario).not.toHaveBeenCalled();
  });

  test('SC-06: Debe manejar JSON malformado con HTTP 400 sin exponer stack traces', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "invalido", "password": ');

    expect(res.statusCode).toBe(400);
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('at Object.');
  });

  test('SC-07: La contraseña ingresada no debe aparecer en la respuesta de error', async () => {
    authService.autenticarYProvisionarUsuario.mockRejectedValueOnce(
      new Error('Credenciales inválidas')
    );

    const passwordSecreto = 'PasswordSecreto2026!';
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@zoron.cl', password: passwordSecreto });

    expect(JSON.stringify(res.body)).not.toContain(passwordSecreto);
  });

  test('SC-08: SQL Injection en query params debe ser neutralizada (consultas parametrizadas)', async () => {
    db.query.mockResolvedValue({ rows: [] });

    await request(app)
      .get("/api/movimientos?id=1%20OR%201=1%20--")
      .set('Origin', 'https://teamzoron.cl');

    for (const llamada of db.query.mock.calls) {
      const sql = llamada[0];
      expect(sql).not.toMatch(/OR 1=1/i);
      expect(sql).not.toMatch(/OR '1'='1'/i);
    }
  });

  test('SC-09: Métodos HTTP no permitidos en /api/auth/login deben ser rechazados (no GET/PUT/DELETE)', async () => {
    const resGet = await request(app).get('/api/auth/login');
    expect([404, 405]).toContain(resGet.statusCode);

    const resDelete = await request(app).delete('/api/auth/login');
    expect([404, 405]).toContain(resDelete.statusCode);
  });

  test('SC-10: Los errores 500 controlados no deben exponer rutas internas del servidor ni stack traces', async () => {
    db.query.mockRejectedValueOnce(new Error('relation "users" does not exist'));

    const res = await request(app).get('/');

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('/src/');
    expect(bodyStr).not.toContain('node_modules');
    expect(bodyStr).not.toContain('at Object.');
    expect(res.body.stack).toBeUndefined();
  });
});