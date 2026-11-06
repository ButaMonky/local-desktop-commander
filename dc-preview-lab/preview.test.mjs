import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUiToolMeta, FILE_PREVIEW_RESOURCE_URI, CONFIG_EDITOR_RESOURCE_URI } from './candidate/dist/ui/contracts.js';

// Catch a preview reappearing when the upstream A/B flag is true or omitted.
for (const resource of [FILE_PREVIEW_RESOURCE_URI, CONFIG_EDITOR_RESOURCE_URI]) {
  for (const enabled of [undefined, true, false]) {
    test(`no automatic UI advertisement: ${resource}, upstream=${enabled}`, () => {
      const descriptor = { name: 'fixture', inputSchema: { type: 'object' },
        _meta: buildUiToolMeta(resource, true, enabled) };
      const wire = JSON.parse(JSON.stringify(descriptor));
      assert.equal(Object.hasOwn(wire, '_meta'), false);
      assert.deepEqual(wire, { name: 'fixture', inputSchema: { type: 'object' } });
    });
  }
}
