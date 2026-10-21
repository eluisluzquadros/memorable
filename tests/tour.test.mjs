import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUR_STEPS, TOUR_VERSION, shouldOfferTour, tourPreference } from '../src/tour.mjs';
import { initialState, workspaces } from '../src/workflow.mjs';
import { hydrateOperations } from '../src/operations.mjs';
test('tour offers first visit, respects session skip, permanent dismissal and completion', () => {
  assert.equal(shouldOfferTour(undefined,false),true);
  assert.equal(shouldOfferTour(undefined,true),false);
  assert.equal(shouldOfferTour(tourPreference('dismissed',false),false),true);
  assert.equal(shouldOfferTour(tourPreference('dismissed',true),false),false);
  assert.equal(shouldOfferTour(tourPreference('completed',false),false),false);
  assert.equal(shouldOfferTour({version:TOUR_VERSION-1,status:'completed'},false),true);
  assert.equal(shouldOfferTour({version:TOUR_VERSION-1,status:'dismissed',dontShowAgain:true},false),false);
});
test('onboarding preference survives account/demo hydration without changing production data', () => {
  const original=initialState(), preference=tourPreference('dismissed',true);
  const restored=hydrateOperations(JSON.parse(JSON.stringify({...original,onboarding:{tour:preference}})),workspaces);
  assert.deepEqual(restored.onboarding.tour,preference);
  assert.deepEqual(restored.pieces,original.pieces);
  assert.equal(TOUR_STEPS.filter(s=>s.route).length,7);
  assert.ok(TOUR_STEPS.find(s=>s.route==='publicar').tips.some(t=>t.includes('não publica automaticamente')));
});
