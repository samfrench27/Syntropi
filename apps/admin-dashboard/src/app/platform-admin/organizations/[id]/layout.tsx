// The dashboard is published as static files, so this page is built once, for a placeholder id.
// The server (see worker.mjs) answers every real id with this page, and the page reads the real id
// from the browser address (see useRouteParams).
export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
