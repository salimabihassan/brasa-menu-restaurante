import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import webPush from 'web-push';
import {allowedPushEndpoint,readyPushPayload,staffPushPayload,pushErrorStatus} from '../supabase/functions/_shared/push-policy.ts';
test('push targets reject local URLs, credentials and lookalike providers',()=>{
 for(const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user:pass@web.push.apple.com/x','https://web.push.apple.com:444/x'])assert.equal(allowedPushEndpoint(url),false,url);
 for(const url of ['https://fcm.googleapis.com/x','https://web.push.apple.com/x','https://updates.push.services.mozilla.com/x'])assert.equal(allowedPushEndpoint(url),true,url);
 assert.equal(pushErrorStatus(410),'expired');assert.equal(pushErrorStatus(201),'sent');assert.equal(pushErrorStatus(503),'failed');
});
test('push encrypts a minimal payload without customer contact or order contents',()=>{
 const device=createECDH('prime256v1');device.generateKeys();
 const vapid=webPush.generateVAPIDKeys();const payload=JSON.stringify(readyPushPayload('20000000-0000-0000-0000-000000000001'));
 assert.deepEqual(Object.keys(JSON.parse(payload)).sort(),['orderId','type']);
 const request=webPush.generateRequestDetails({endpoint:'https://fcm.googleapis.com/test',keys:{p256dh:device.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},payload,{TTL:300,vapidDetails:{subject:'mailto:test@brasa.invalid',...vapid}});
 assert.ok(request.headers.Authorization);assert.ok(request.body.length>payload.length);assert.equal(request.body.includes(Buffer.from(payload)),false);
});
test('staff payload exposes only the order reference and event, never customer or banking data',()=>{
 assert.deepEqual(staffPushPayload('test','receipt_resubmitted'),{type:'BRASA_STAFF_ORDER',orderId:'test',event:'receipt_resubmitted'});
 assert.equal(staffPushPayload('test','unexpected').event,'new_order');
});
