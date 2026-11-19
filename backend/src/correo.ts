import nodemailer from 'nodemailer'

export function correoConfigurado() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function enviarCorreo(destino: string, asunto: string, texto: string) {
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
  })
  return true
}
