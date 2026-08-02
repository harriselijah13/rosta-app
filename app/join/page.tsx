import { redirect } from 'next/navigation'

// Signup is now fully open — anyone hitting /join (old invite links,
// bookmarks, marketing materials) lands directly on /signup.
// JoinRequestForm.tsx is preserved in case the join-request flow is
// reinstated later.
export default function JoinPage() {
  redirect('/signup')
}
