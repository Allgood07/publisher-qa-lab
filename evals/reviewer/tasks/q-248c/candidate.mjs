import assert from 'node:assert/strict';

export function verify(site) {
  const older = { headline: 'Opening hours', detail: 'Opens at nine' };
  const newer = { headline: 'Holiday hours', detail: 'Opens at eleven' };
  site.publish(older);
  site.save(newer);
  assert.deepEqual(site.readPublic(), older);
  site.publishSaved();
  assert.deepEqual(site.readPublic(), newer);
}
