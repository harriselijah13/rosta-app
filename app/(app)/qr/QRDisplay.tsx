'use client'

import QRCode from 'react-qr-code'

export default function QRDisplay({ url }: { url: string }) {
  return (
    <QRCode
      value={url}
      size={220}
      fgColor="#0F1B3C"
      bgColor="#FFFFFF"
    />
  )
}
