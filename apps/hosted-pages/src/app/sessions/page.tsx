import HostedSession from '@/components/HostedSession'

// One static page for every payment id: the id and token are read in the browser
// (see src/lib/logic.mjs), and /sessions/* is rewritten to this file by public/_redirects.
export default function SessionPage() {
  return <HostedSession />
}
