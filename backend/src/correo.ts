import nodemailer from 'nodemailer'
import { saludoMexico, textoAvisoAdmin, textoClaveTemporal } from '../../shared/mensajes-correo.ts'

const SITIO = 'https://laboratorioscontrol.vercel.app/'

export function correoConfigurado() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

function escapar(value: string) {
  return value.replace(/[&<>"']/g, (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caracter] ?? caracter)
}

function carta(cuerpo: string) {
  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#e7eef8;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e7eef8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7e2f0;">
        <tr><td style="background:#0e2f57;padding:22px 28px;">
          <p style="margin:0;color:#ffffff;font-size:13px;letter-spacing:0.16em;font-weight:700;">LAB CONTROL</p>
          <p style="margin:6px 0 0;color:#dbeafe;font-size:14px;">Administración de laboratorios</p>
        </td></tr>
        <tr><td style="padding:28px;">${cuerpo}</td></tr>
        <tr><td style="padding:0 28px 22px;color:#5b6b82;font-size:12px;line-height:1.5;">Este mensaje lo envía LAB CONTROL. No compartas la contraseña.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function correoClaveTemporal(nombre: string, correo: string, clave: string) {
  const saludo = saludoMexico()
  const texto = textoClaveTemporal(nombre, correo, clave)
  const html = carta(`
    <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:#071833;">${escapar(saludo)}, ${escapar(nombre)}.</p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">El administrador te envía una contraseña temporal para entrar al sistema de los laboratorios.</p>
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#5b6b82;">Contraseña temporal</p>
    <p style="margin:0 0 18px;padding:16px;border-radius:12px;background:#eff6ff;text-align:center;font-size:28px;letter-spacing:0.14em;font-weight:800;color:#071833;">${escapar(clave)}</p>
    <p style="margin:0 0 8px;font-size:16px;line-height:1.5;">Entra con <strong>${escapar(correo)}</strong>.</p>
    <p style="margin:0 0 18px;"><a href="${SITIO}" style="display:inline-block;background:#0e2f57;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Abrir LAB CONTROL</a></p>
    <p style="margin:0;font-size:15px;line-height:1.5;">Al entrar, el sistema te pedirá que elijas una contraseña propia. Si tú no pediste este cambio, no uses la contraseña y avisa al administrador.</p>
  `)
  return { asunto: 'LAB CONTROL · Contraseña temporal', texto, html }
}

export function correoAvisoAdmin(admin: string, nombre: string, correo: string) {
  const saludo = saludoMexico()
  const texto = textoAvisoAdmin(admin, nombre, correo)
  const html = carta(`
    <p style="margin:0 0 12px;font-size:22px;font-weight:700;color:#071833;">${escapar(saludo)}, ${escapar(admin)}.</p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.5;"><strong>${escapar(nombre)}</strong> indicó que olvidó su contraseña de LAB CONTROL.</p>
    <p style="margin:0 0 18px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #d7e2f0;font-size:15px;">Correo de la cuenta<br><strong>${escapar(correo)}</strong></p>
    <p style="margin:0 0 18px;font-size:16px;line-height:1.5;">Entra al sistema, abre Usuarios y pulsa Enviar por correo. Ahí puedes confirmar o corregir la dirección antes de mandarla.</p>
    <p style="margin:0;"><a href="${SITIO}" style="display:inline-block;background:#0e2f57;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Abrir LAB CONTROL</a></p>
  `)
  return { asunto: 'LAB CONTROL · Solicitud de contraseña', texto, html }
}

export async function enviarCorreo(destino: string, asunto: string, texto: string, html?: string) {
  if (!correoConfigurado()) return false
  const puerto = Number(process.env.SMTP_PORT || 587)
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: puerto,
    secure: puerto === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
  await transporte.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: destino,
    subject: asunto,
    text: texto,
    html,
  })
  return true
}
