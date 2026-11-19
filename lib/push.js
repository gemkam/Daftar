/* Phone notifications for the employee salary slip shortcut (public key; the private key is in the database). */
export const VAPID_PUBLIC = 'BHfZjl_o5ACydqCAATdtXFEPwbwmL3D-HOM-omJ81FHXRAWTqHGS1umcvQQSxejKwo7w3S5w04vKBJWAX86Hkww';

export function keyBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
