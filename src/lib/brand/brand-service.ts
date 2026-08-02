export async function generateBrandReport(data: any) {
  const response = await fetch('/api/brand/express', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}
