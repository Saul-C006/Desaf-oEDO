-- =====================================================================
-- TECHFIX - Preparación de MySQL LOCAL (solo en su computadora)
-- Ejecutar UNA vez como administrador (root):
--     mysql -u root -p < database/crear_bd_local.sql
--
-- Crea la base "techfix" y un usuario "techfix_app" con permisos MÍNIMOS:
-- solo puede leer y modificar datos de esa base (no puede borrar tablas
-- ni tocar otras bases). La aplicación se conectará con este usuario.
--
-- IMPORTANTE: cambie 'CAMBIE_ESTA_CLAVE' por una contraseña propia y
-- póngala SOLO en su archivo .env (nunca en el código ni en GitHub).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS techfix
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'techfix_app'@'localhost' IDENTIFIED BY 'CAMBIE_ESTA_CLAVE';

-- Permisos mínimos para que la aplicación funcione.
GRANT SELECT, INSERT, UPDATE, DELETE ON techfix.* TO 'techfix_app'@'localhost';

FLUSH PRIVILEGES;
