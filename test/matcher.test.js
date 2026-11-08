import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModel, modelFeatures, predict, validateModel } from '../public/matcher.js';
const valid = () => ({schema:'applyflow-reviewed-v1', deployable:true, label_method:'human_independent', training_rights_confirmed:true, features:['intercept','job_word_coverage','resume_word_coverage','term_frequency_cosine','log_resume_words','log_job_words'], weights:[0,1,1,1,0,0],threshold:.5,test_metrics:{f1:.85,precision:.85,recall:.85,positive:50,negative:50},baseline:{f1:.5}});
test('browser feature calculation matches training definition', () => {
 const x = modelFeatures('Python React React', 'React Python testing');
 assert.equal(x[1],2/3); assert.equal(x[2],1); assert.ok(Math.abs(x[3]-3/Math.sqrt(15))<1e-12); assert.equal(x[4],Math.log1p(3)/10);
});
test('evaluation checks reject weak, malformed, and original experimental models', () => {
 assert.ok(validateModel(valid()));
 for (const patch of [{deployable:false},{schema:'ridge_regression'},{weights:[NaN]},{threshold:2},{training_rights_confirmed:false},{test_metrics:{...valid().test_metrics,f1:.5}},{test_metrics:{...valid().test_metrics,negative:0}}]) assert.ok(!validateModel({...valid(),...patch}));
 assert.throws(()=>predict({},'resume','job'));
});
test('missing, invalid and unavailable models use local fallback', async () => {
 assert.equal(await loadModel(async()=>({ok:false})),null);
 assert.equal(await loadModel(async()=>{throw Error('offline')}),null);
 assert.equal(await loadModel(async()=>({ok:true,json:async()=>({})})),null);
 assert.ok(await loadModel(async()=>({ok:true,json:async()=>valid()})));
});
