import assert from 'node:assert/strict';

export function verify(site) {
  const older = { headline: 'Pickup schedule', detail: 'Monday' };
  const newer = { headline: 'Revised pickup schedule', detail: 'Wednesday' };
  site.publish(older);
  site.save(newer);
  assert.deepEqual(site.readPublic(), older);
  site.publishSaved();
  assert.deepEqual(site.readPreview(), newer);
}
