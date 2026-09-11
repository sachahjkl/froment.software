export function contactMailto(subject: string, body: string): string {
  const parameters: string[] = [];
  // RFC 6068 §5 réserve les retours à la ligne au corps et impose CRLF.
  if (subject) {
    parameters.push(`subject=${encodeURIComponent(subject.replace(/[\r\n]+/g, ' '))}`);
  }
  if (body) {
    parameters.push(`body=${encodeURIComponent(body.replace(/\r\n|\r|\n/g, '\r\n'))}`);
  }
  const query = parameters.join('&');
  return `mailto:contact@froment.software${query ? `?${query}` : ''}`;
}
