import test from 'node:test';
import assert from 'node:assert/strict';
import {triageExpanded,expandedTitleSignals} from '../lib/expanded-triage.mjs';
test('subject clues are provisional and never auto-approved',()=>{
 const a=triageExpanded({originalDecision:'unclassified',originalTitle:'邪修老祖带你手搓万能麻酱汁'});
 assert.equal(a.topic,'生活');assert.equal(a.provisional,true);
 const b=triageExpanded({originalDecision:'invalid',originalTitle:'已失效视频'},{description:'本期主要介绍量化交易分析'});
 assert.equal(b.status,'invalid_description_hint');assert.equal(b.confidence,'low');
 const c=triageExpanded({originalDecision:'invalid',originalTitle:'已失效视频'},{description:''});
 assert.equal(c.topic,null);
});
test('nonspecific content remains unassigned',()=>{
 const v=triageExpanded({originalDecision:'unclassified',originalTitle:'中午好'});
 assert.equal(v.topic,null);
 assert.deepEqual(expandedTitleSignals('中午好'),{});
});
