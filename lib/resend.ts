const FROM = 'ROSTA <hello@onrosta.com>'
const BASE = 'https://app.onrosta.com'

// ── Shared HTML escape (used by adminEmailHtml) ───────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Branded template ──────────────────────────────────────────────────────────
//
// Full HTML document so email clients that support web fonts (Apple Mail,
// iOS Mail) load Fraunces (headings) and Plus Jakarta Sans (body).
// Clients that strip <style>/@import fall back to the inline font stacks.

function wrap(
  heading: string,
  body: string,
  ctaLabel: string,
  ctaUrl: string,
  opts?: { preLineBody?: boolean },
): string {
  const bodyStyle = [
    'color:#6B7280',
    'font-size:15px',
    'line-height:1.6',
    'margin:0 0 28px',
    "font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    opts?.preLineBody ? 'white-space:pre-line' : '',
  ].filter(Boolean).join(';')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700&family=Plus+Jakarta+Sans:wght@400;600&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F2EE;">
  <div style="font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:48px 24px;background:#F5F2EE;">
    <p style="font-size:22px;font-weight:700;color:#0F1B3C;margin:0 0 4px;font-family:'Fraunces',Georgia,serif;">ROSTA<span style="color:#C8F53C;">.</span></p>
    <hr style="border:none;border-top:1px solid #E5E1DB;margin:20px 0 32px;"/>
    <h1 style="font-size:24px;color:#0F1B3C;margin:0 0 12px;font-weight:700;font-family:'Fraunces',Georgia,serif;">${heading}</h1>
    <p style="${bodyStyle}">${body}</p>
    <a href="${ctaUrl}" style="display:inline-block;background:#0F1B3C;color:#ffffff;padding:13px 28px;border-radius:100px;text-decoration:none;font-weight:600;font-size:15px;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;">${ctaLabel}</a>
    <p style="color:#6B7280;font-size:12px;margin-top:32px;line-height:1.5;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;">You're receiving this because you're a member of ROSTA.</p>
    <p style="color:#6B7280;font-size:12px;margin-top:6px;line-height:1.5;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;"><a href="https://app.onrosta.com/privacy" style="color:#6B7280;text-decoration:underline;">Privacy Policy</a> &middot; onrosta.com</p>
  </div>
</body>
</html>`
}

// ── Resend helper ─────────────────────────────────────────────────────────────

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

// ── Email templates ───────────────────────────────────────────────────────────

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

export function openTableStartedEmail(recipientName: string, roomId: string) {
  return wrap(
    'Your Open Table is live',
    `Hi ${recipientName}, you've been matched into an Open Table group for this month. You have 7 days to connect with your group. The opening question is waiting for you inside.`,
    'Open your table',
    `${BASE}/open-tables/${roomId}`,
  )
}

export function openTableFallbackEmail(recipientName: string) {
  return wrap(
    'Open Table — not enough members this month',
    `Hi ${recipientName}, not enough members opted in for an Open Table this month. We'll try again next month — keep an eye out for the option in your settings.`,
    'Back to your dashboard',
    `${BASE}/dashboard`,
  )
}

export function verificationApprovedEmail(name: string, priceAed: number, tier: string) {
  const tierLabel = tier === 'founding' ? 'Founding Member' : tier === 'connector' ? 'Connector' : 'Standard'
  return wrap(
    'Your verification request has been approved',
    `Hi ${name}, your request to become a Verified ROSTA member has been approved. Your applicable tier is <strong>${tierLabel}</strong> at AED ${priceAed.toFixed(2)}. Complete your payment to receive your verified badge.`,
    'Complete payment',
    `${BASE}/verify/pay`,
  )
}

export function verificationRejectedEmail(name: string, reason: string) {
  return wrap(
    'Your verification request was not approved',
    `Hi ${name}, after reviewing your request we were unable to approve your ROSTA verification at this time.</p><p style="color:#6B7280;font-size:15px;line-height:1.6;margin:16px 0 0;"><strong style="color:#0F1B3C;">Reason:</strong> ${reason}`,
    'Back to your profile',
    `${BASE}/dashboard`,
  )
}

export function verificationPaidEmail(name: string) {
  return wrap(
    'You are now a Verified ROSTA member',
    `Hi ${name}, your payment has been processed and your Verified badge is now live on your profile. Thank you for your commitment to the network.`,
    'View your profile',
    `${BASE}/dashboard`,
  )
}

export function onboardingReminderEmail() {
  return wrap(
    'Finish setting up your ROSTA profile',
    "You're almost in. Your account is ready — you just need to complete your profile to join the network.",
    'Complete your profile',
    'https://app.onrosta.com/onboarding',
  )
}

export function adminVerificationGrantedEmail(name: string) {
  return wrap(
    "You're now a Verified ROSTA member",
    `Hi ${name}, the ROSTA team has granted you Verified status. Your verified badge is now live on your profile — no further action needed.`,
    'View your profile',
    `${BASE}/dashboard`,
  )
}

// ── Weekly digest (AI-generated body — needs white-space:pre-line) ────────────

export function digestEmailHtml(name: string, body: string): string {
  return wrap(
    'Your network this week',
    body,
    'Open ROSTA',
    `${BASE}/members`,
    { preLineBody: true },
  )
}

// ── Business card scan invite ─────────────────────────────────────────────────

export function scanCardInviteEmail(
  recipientName: string,
  memberName: string,
  metAt: string,
  inviteCode: string | null,
): string {
  const body = `Hi ${recipientName},\n\n${memberName} met you at ${metAt} and wants to stay connected. They use ROSTA — a professional network built around real introductions.\n\nJoin here${inviteCode ? ` — use invite code: ${inviteCode}` : ''}.`
  return wrap(
    `${memberName} wants to connect on ROSTA`,
    body,
    'Join ROSTA',
    inviteCode ? `${BASE}/signup?invite=${inviteCode}` : `${BASE}/signup`,
    { preLineBody: true },
  )
}

// ── Admin email blast (free-text body — HTML-escaped) ─────────────────────────

export function adminEmailHtml(subject: string, body: string): string {
  const escapedBody = escapeHtml(body).replace(/\n/g, '<br/>')
  return wrap(escapeHtml(subject), escapedBody, 'Go to ROSTA', `${BASE}/dashboard`)
}
