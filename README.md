# ZORON -- Plataforma de Gestión Financiera

![Proyecto Capstone 2026](https://img.shields.io/badge/Capstone-2026--002D-1f6feb)
![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)
![Base de datos](https://img.shields.io/badge/Base%20de%20datos-PostgreSQL-4169e1)
![Testing](https://img.shields.io/badge/Testing-Jest%20%2B%20Supertest-brightgreen)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088ff)

Repositorio del proyecto **ATP Capstone 2026 -- 002D**, desarrollado en el marco de la carrera de Ingeniería en Informática de Duoc UC, sede Valparaíso.

**Integrantes:** Sebastián Ignacio Barrios Varas y Gabriel Francisco Tello Fernández  
**Empresa:** ZORON E.I.R.L.  
**Proyecto:** Plataforma de Gestión Financiera  

---

## 1. Descripción general

**ZORON** es una plataforma interna desarrollada para **ZORON E.I.R.L.**, empresa dedicada a la consultoría en sostenibilidad y cambio climático. Su objetivo es fortalecer la gestión y organización de la información empresarial mediante herramientas que permitan sistematizar procesos internos, centralizar registros y facilitar el análisis de información para la toma de decisiones.

La solución está orientada a los colaboradores y al equipo administrativo de la empresa. Integra funcionalidades de acceso restringido, gestión de movimientos financieros, consulta de proyectos mediante navegación de detalle (*drill-down*), carga masiva de planillas Excel, dashboards de indicadores contables, simulación de proyecciones financieras en memoria y una **suite completa de pruebas automatizadas (unitarias, integración, rendimiento y seguridad)**.

### Funcionalidades principales

- Acceso restringido y autenticación híbrida (cPanel IMAP/Shadow y PostgreSQL).
- Registro, consulta, edición y eliminación de movimientos financieros.
- Visualización de proyectos y navegación hacia su información detallada.
- Carga masiva de movimientos desde archivos Excel (hasta 50 MB).
- Procesamiento y normalización de montos en pesos chilenos (CLP) y fechas.
- Dashboards interactivos con indicadores contables y financieros.
- Simulación de proyecciones financieras sin modificar los registros persistidos.
- Documentación interactiva de los servicios del backend mediante Swagger UI (`/api-docs`).
- **Suite de QA y CI:** 43 casos de prueba automatizados (Jest y Supertest) con Integración Continua en GitHub Actions.

---

## 2. Tecnologías y herramientas

### Frontend
- **React:** Construcción de la interfaz mediante componentes reutilizables y gestión del estado.
- **Vite:** Herramienta de desarrollo y compilación del frontend.
- **React Router DOM:** Navegación entre los módulos de la plataforma.
- **Chart.js y react-chartjs-2:** Visualización de gráficos de indicadores financieros.
- **SheetJS (xlsx):** Lectura y procesamiento de archivos Excel desde el navegador.
- **Axios:** Comunicación HTTP con la API REST del backend.

### Backend
- **Node.js:** Entorno de ejecución de JavaScript del lado del servidor.
- **Express:** Framework para implementar rutas, controladores y middlewares de la API REST.
- **pg (node-postgres):** Conexión y administración de consultas y transacciones con PostgreSQL.
- **CORS:** Configuración estricta del acceso entre orígenes (`teamzoron.cl` y `zoron.cl`).
- **dotenv:** Lectura de variables de entorno y configuración sensible.
- **Swagger UI Express:** Publicación de la documentación interactiva de la API.

### Testing y Calidad de Software (QA)
- **Jest (v29.7.0):** Motor de pruebas unitarias, de integración, rendimiento y seguridad.
- **Supertest (v7.0.0):** Pruebas de integración HTTP sobre la aplicación Express real.
- **GitHub Actions:** Pipeline de Integración Continua (CI) para ejecución automática de pruebas.

### Base de datos e infraestructura
- **PostgreSQL:** Almacenamiento persistente de la información.
- **pgAdmin 4 / phpPgAdmin:** Administración y gestión de la base de datos y secuencias.
- **BlueHosting / cPanel:** Infraestructura de alojamiento en producción (`teamzoron.cl`).

### Desarrollo y gestión
- **npm / npx:** Administración de dependencias.
- **Git / GitHub:** Control de versiones y CI/CD.
- **Trello:** Organización de tareas mediante Kanban.

---

## 3. Arquitectura del sistema

La solución utiliza una arquitectura de tres capas. El frontend consume los servicios REST expuestos por el backend, mientras que este administra la comunicación segura con PostgreSQL y el servicio de autenticación corporativa.

``` text
┌──────────────────────────────┐
│      Cliente / Navegador     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   Frontend: React + Vite     │
│     Chart.js / Axios         │
└──────────────┬───────────────┘
               │ HTTP / API REST
               ▼
┌──────────────────────────────┐
│  Backend: Node.js/Express    │
│    Rutas y controladores     │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          PostgreSQL          │
│         Base de datos        │
└──────────────────────────────┘
```

---

## 4. Requisitos previos

Para ejecutar el proyecto localmente se requiere:
- Node.js (versión 18 o superior).
- npm (incluido con Node.js).
- PostgreSQL en ejecución o acceso a una instancia remota.
- Git para clonar el repositorio.

---

## 5. Instalación y ejecución local

### Paso 1. Clonar el repositorio
```bash
git clone https://github.com/Sebastianignaciobarriosvaras/capstone-2026--002D--Sebasti-n_Barrios-Gabriel_Tello-.git
cd capstone-2026--002D--Sebasti-n_Barrios-Gabriel_Tello-
```

### Paso 2. Configurar el backend
Ingresar a la carpeta del backend e instalar dependencias:
```bash
cd Backend
npm install
```

Crear un archivo `.env` dentro de `Backend/`:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=zoron_bd
```

### Paso 3. Configurar el frontend
```bash
cd ../Frontend
npm install
```

### Paso 4. Iniciar los servicios (Dos terminales)

**Terminal 1 -- Backend**
```bash
cd Backend
npm run dev
```

**Terminal 2 -- Frontend**
```bash
cd Frontend
npm run dev
```
Disponible habitualmente en `http://localhost:5173`.

---

## 6. Suite de Pruebas Automatizadas (QA)

El proyecto cuenta con una robusta suite de **43 casos de prueba automatizados** distribuidos en cuatro categorías:

| Categoría | Casos | Descripción |
|-----------|-------|-------------|
| **Unitarias (`tests/unit/`)** | 12 | Validación criptográfica (`scrypt`), normalización CLP, fechas Excel, cálculo de IVA y validadores corporativos. |
| **Integración (`tests/integration/`)** | 14 | Pruebas HTTP con `supertest` sobre endpoints reales (`/`, `/api/auth/login`, `/api/movimientos`, `/api/proyectos`, etc.). |
| **Rendimiento (`tests/performance/`)** | 7 | Pruebas de estrés y procesamiento masivo (10.000 a 100.000 registros contables y 50 peticiones concurrentes). |
| **Seguridad (`tests/security/`)** | 10 | Mitigación OWASP Top Ten (SQL Injection, CORS, IMAP CRLF Injection, XSS, hardening de errores 500). |

### Ejecutar las pruebas localmente:
Para ejecutar toda la suite y generar el reporte de cobertura de código:
```bash
cd Backend
npm run test:coverage
```

---

## 7. Módulos de la plataforma

- **Movimientos:** Gestión y conciliación de registros financieros.
- **Proyectos:** Consulta y navegación con detalle (*drill-down*).
- **Dashboard:** Visualización de indicadores contables y gráficos interactivos.
- **Carga Masiva:** Importación y normalización desde planillas Excel (hasta 50 MB).
- **Proyecciones:** Simulación de escenarios financieros en memoria.

---

## 8. Integrantes y responsabilidades

- **Sebastián Ignacio Barrios Varas:** Levantamiento de requerimientos, modelamiento BPMN, diseño de base de datos PostgreSQL y desarrollo frontend (React, Dashboard, Proyectos, Proyecciones, Carga Masiva).
- **Gabriel Francisco Tello Fernández:** Estructuración de información, desarrollo backend (Node.js, Express, API REST), lógica de negocio, transacciones masivas, integración con PostgreSQL y automatización de la suite de pruebas (QA).

---

## 9. Acceso a la plataforma y documentación

- **Sitio corporativo:** [https://zoron.cl](https://zoron.cl)
- **Plataforma interna:** [https://teamzoron.cl](https://teamzoron.cl)
- **Documentación Swagger API:** `http://localhost:3000/api-docs`

---

## Información académica

**Proyecto:** Capstone -- Ingeniería en Informática  
**Código:** ATP Capstone 2026 -- 002D  
**Institución:** Duoc UC -- Sede Valparaíso  
**Empresa:** ZORON E.I.R.L.
