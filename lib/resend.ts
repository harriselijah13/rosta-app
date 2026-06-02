const FROM = 'ROSTA <hello@onrosta.com>'

function wrap(heading: string, body: string, ctaLabel: string, ctaUrl: string) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:48px 24px;background:#F5F2EE;">
      <p style="font-size:22px;font-weight:700;color:#0F1B3C;margin:0 0 4px;">ROSTA<span style="color:#C8F53C;">.</span></p>
      <hr style="border:none;border-top:1px solid #E5E1DB;margin:20px 0 32px;"/>
      <h1 style="font-size:24px;color:#0F1B3C;margin:0 0 12px;font-weight:700;">${heading}</h1>
      <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;">${body}</p>
      <a href="${ctaUrl}" style="display:inline-block;background:#0F1B3C;color:#ffffff;padding:13px 28px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;">${ctaLabel}</a>
      <p style="color:#6B7280;font-size:12px;margin-top:32px;line-height:1.5;">You're receiving this because you're a member of ROSTA.</p>
    </div>`
}

export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    console.error('[resend] send failed', { to, subject, status: res.status, body: await res.text() })
  }
}

const BASE = 'https://app.onrosta.com'

export function introRequestEmail(
  facilitatorName: string,
  requesterName: string,
  targetName: string,
  note: string,
  requestId: string,
) {
  const noteHtml = note
    ? `<blockquote style="border-left:3px solid #C8F53C;margin:0 0 28px;padding:12px 16px;background:#fff;border-radius:0 8px 8px 0;color:#0F1B3C;font-size:15px;font-style:italic;">${note}</blockquote>`
    : ''
  return wrap(
    `${requesterName} wants an intro to ${targetName}`,
    `Hi ${facilitatorName}, ${requesterName} is hoping you can introduce them to ${targetName}. Here's what they said:</p>${noteHtml}<p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;">You have 48 hours to accept or decline.`,
    'Review request',
    `${BASE}/intro/${requestId}`,
  )
}

export function introAcceptedEmailToRequester(
  requesterName: string,
  facilitatorName: string,
  targetName: string,
  targetSlug: string,
  facilitatorNote: string,
) {
  const noteHtml = facilitatorNote
    ? `<blockquote style="border-left:3px solid #C8F53C;margin:0 0 28px;padding:12px 16px;background:#fff;border-radius:0 8px 8px 0;color:#0F1B3C;font-size:15px;font-style:italic;">${facilitatorNote}</blockquote>`
    : ''
  return wrap(
    `Your intro to ${targetName} is happening`,
    `Hi ${requesterName}, ${facilitatorName} has accepted your intro request and connected you with ${targetName}. ${noteHtml ? "Here's their note:</p>" + noteHtml + '<p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0;">' : ''}Reach out and say hello.`,
    `View ${targetName}'s profile`,
    `${BASE}/profile/${targetSlug}`,
  )
}

export function introAcceptedEmailToTarget(
  targetName: string,
  facilitatorName: string,
  requesterName: string,
  requesterSlug: string,
  note: string,
  facilitatorNote: string,
) {
  const reqNoteHtml = note
    ? `<blockquote style="border-left:3px solid #C8F53C;margin:0 0 16px;padding:12px 16px;background:#fff;border-radius:0 8px 8px 0;color:#0F1B3C;font-size:15px;font-style:italic;">${note}</blockquote>`
    : ''
  const facNoteHtml = facilitatorNote
    ? `<p style="color:#6B7280;font-size:14px;margin:0 0 28px;">Note from ${facilitatorName}: <em>${facilitatorNote}</em></p>`
    : ''
  return wrap(
    `${facilitatorName} connected you with ${requesterName}`,
    `Hi ${targetName}, ${facilitatorName} thought you and ${requesterName} should meet. ${reqNoteHtml ? "Here's why they wanted the intro:</p>" + reqNoteHtml + facNoteHtml + '<p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0;">Say hello.' : 'Say hello.'}`,
    `View ${requesterName}'s profile`,
    `${BASE}/profile/${requesterSlug}`,
  )
}

export function guestWelcomeEmail(
  guestName: string,
  hostName: string,
  hostWhatIDo: string | null,
  hostBuildingNow: string | null,
) {
  const profileLines = [
    hostWhatIDo && `<p style="color:#6B7280;font-size:14px;margin:0 0 6px;"><strong style="color:#0F1B3C;">What they do:</strong> ${hostWhatIDo}</p>`,
    hostBuildingNow && `<p style="color:#6B7280;font-size:14px;margin:0;"><strong style="color:#0F1B3C;">Building now:</strong> ${hostBuildingNow}</p>`,
  ].filter(Boolean).join('')

  const profileCard = `
    <div style="background:#fff;border:1px solid #E5E1DB;border-radius:12px;padding:16px 20px;margin:0 0 28px;">
      <p style="color:#0F1B3C;font-size:15px;font-weight:700;margin:0 0 8px;">${hostName}</p>
      ${profileLines}
    </div>`

  return wrap(
    `You connected with ${hostName}`,
    `Hi ${guestName}, you connected with ${hostName} on ROSTA. Here&apos;s who they are:</p>${profileCard}<p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;">ROSTA is a professional network for founders, creatives, and operators. Join to see ${hostName}&apos;s full profile and stay connected.`,
    'Join ROSTA',
    `${BASE}/signup`,
  )
}

export function guestNotifyHostEmail(
  hostName: string,
  guestName: string,
  guestEmail: string,
  guestWhatIDo: string,
) {
  return wrap(
    `${guestName} connected with you`,
    `Hi ${hostName}, someone scanned your guest QR code.</p>
    <div style="background:#fff;border:1px solid #E5E1DB;border-radius:12px;padding:16px 20px;margin:0 0 28px;">
      <p style="color:#0F1B3C;font-size:15px;font-weight:700;margin:0 0 4px;">${guestName}</p>
      <p style="color:#6B7280;font-size:14px;margin:0 0 4px;">${guestWhatIDo}</p>
      <p style="color:#6B7280;font-size:13px;margin:0;">${guestEmail}</p>
    </div>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;">They&apos;ve been sent an email inviting them to join ROSTA.`,
    'View your connections',
    `${BASE}/members`,
  )
}

export function qrConnectedToOwnerEmail(
  ownerName: string,
  scannerName: string,
  scannerSlug: string,
) {
  return wrap(
    `${scannerName} connected with you`,
    `${scannerName} scanned your member QR code and connected with you on ROSTA.`,
    `View ${scannerName}'s profile`,
    `${BASE}/profile/${scannerSlug}`,
  )
}

export function qrConnectedToScannerEmail(
  scannerName: string,
  ownerName: string,
  ownerSlug: string,
) {
  return wrap(
    `You're connected with ${ownerName}`,
    `You connected with ${ownerName} via their member QR code. Say hello.`,
    `View ${ownerName}'s profile`,
    `${BASE}/profile/${ownerSlug}`,
  )
}

export function openDoorRequestEmail(
  targetName: string,
  requesterName: string,
  note: string,
  requestId: string,
) {
  const noteHtml = note
    ? `<blockquote style="border-left:3px solid #C8F53C;margin:0 0 28px;padding:12px 16px;background:#fff;border-radius:0 8px 8px 0;color:#0F1B3C;font-size:15px;font-style:italic;">${note}</blockquote>`
    : ''
  return wrap(
    `${requesterName} wants to connect`,
    `Hi ${targetName}, ${requesterName} found your profile and wants to connect. ${noteHtml ? "Here's what they said:</p>" + noteHtml + '<p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0;">Accept or decline below.' : 'Accept or decline below.'}`,
    'View request',
    `${BASE}/intro/${requestId}`,
  )
}

export function openDoorAcceptedEmail(
  requesterName: string,
  targetName: string,
  targetSlug: string,
) {
  return wrap(
    `${targetName} accepted your request`,
    `Hi ${requesterName}, ${targetName} accepted your connection request. You're now connected — say hello.`,
    `View ${targetName}'s profile`,
    `${BASE}/profile/${targetSlug}`,
  )
}

export function openDoorDeclinedEmail(
  requesterName: string,
  targetName: string,
) {
  return wrap(
    `Your connection request to ${targetName}`,
    `Hi ${requesterName}, ${targetName} wasn't able to accept your connection request at this time.`,
    'Browse members',
    `${BASE}/members`,
  )
}

export function thankYouEmail(
  facilitatorName: string,
  senderName: string,
  senderSlug: string,
) {
  return wrap(
    `${senderName} said thank you`,
    `Hi ${facilitatorName}, ${senderName} wanted to thank you for the intro — it clearly led somewhere good.`,
    `View ${senderName}'s profile`,
    `${BASE}/profile/${senderSlug}`,
  )
}

export function inviteUsedEmail(
  inviterName: string,
  newMemberName: string,
  newMemberSlug: string,
) {
  return wrap(
    `${newMemberName} joined ROSTA`,
    `Hi ${inviterName}, your invite just brought ${newMemberName} into the network. You earned +1 Connector Score.`,
    `View ${newMemberName}'s profile`,
    `${BASE}/profile/${newMemberSlug}`,
  )
}

export function newMessageEmail(
  recipientName: string,
  senderName: string,
  preview: string,
  conversationId: string,
) {
  return wrap(
    `${senderName} sent you a message`,
    `Hi ${recipientName}, ${senderName} sent you a message on ROSTA:</p>
    <blockquote style="border-left:3px solid #C8F53C;margin:0 0 28px;padding:12px 16px;background:#fff;border-radius:0 8px 8px 0;color:#0F1B3C;font-size:15px;font-style:italic;">${preview}</blockquote>
    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 28px;">Reply to keep the conversation going.`,
    'View message',
    `${BASE}/messages/${conversationId}`,
  )
}

export function connectionNudgeEmail(
  recipientName: string,
  otherName: string,
  conversationId: string,
) {
  return wrap(
    `Say hello to ${otherName}`,
    `Hi ${recipientName}, you connected with ${otherName} 48 hours ago but haven't exchanged a message yet. A quick hello goes a long way.`,
    'Send a message',
    `${BASE}/messages/${conversationId}`,
  )
}

export function introDeclinedEmail(
  requesterName: string,
  facilitatorName: string,
  targetName: string,
  facilitatorNote: string,
) {
  const noteHtml = facilitatorNote
    ? `<p style="color:#6B7280;font-size:14px;margin:16px 0 0;">They said: <em>${facilitatorNote}</em></p>`
    : ''
  return wrap(
    `Your intro request to ${targetName}`,
    `Hi ${requesterName}, ${facilitatorName} wasn't able to facilitate your intro to ${targetName} this time.${noteHtml ? '</p>' + noteHtml + '<p style="display:none;">' : ''}`,
    'Browse members',
    `${BASE}/members`,
  )
}
