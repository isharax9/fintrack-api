import crypto from 'crypto';

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

export const hashOptional = (value?: string | string[]) => {
  if (!value) return undefined;
  return sha256(Array.isArray(value) ? value.join(',') : value);
};
