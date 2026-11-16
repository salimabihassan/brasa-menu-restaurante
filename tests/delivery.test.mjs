import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliveryAddress,googleRouteRequest,readGoogleRoute,deliveryCost} from '../supabase/functions/_shared/delivery-policy.ts';
import {readyEventKey} from '../lib/ready-events.ts';
test('delivery uses exact route meters, final CLP rounding and inclusive coverage',()=>{
 assert.equal(deliveryCost(2501,700,5),1751);assert.equal(deliveryCost(5000,700,5),3500);
 assert.throws(()=>deliveryCost(5001,700,5),/fuera/);assert.throws(()=>deliveryCost(NaN,700,5));
 assert.equal(deliveryCost(0,700,5),0);
});
test('Google route request sends only origin and destination, and fails closed on malformed distances',()=>{
 const request=googleRouteRequest('Origen de prueba','Calle prueba 123','Providencia');
 assert.equal(request.destination.address,'Calle prueba 123, Providencia, Chile');assert.equal(request.routingPreference,'TRAFFIC_UNAWARE');
 assert.equal('name' in request,false);assert.equal('items' in request,false);
 assert.deepEqual(readGoogleRoute({routes:[{distanceMeters:2501,duration:'123.5s'}]}),{meters:2501,seconds:124});
 for(const body of [{},{routes:[{}]},{routes:[{distanceMeters:-1,duration:'10s'}]}])assert.throws(()=>readGoogleRoute(body));
 assert.throws(()=>deliveryAddress('bad\naddress',5,200));
});
test('delivery alerts on dispatch, not on pickup-ready; original pickup alert remains unchanged',()=>{
 const order={id:'test',createdAt:'2026-11-16T15:00:00Z',history:[],fulfillment:'delivery',status:'ready'};
 assert.equal(readyEventKey(order),null);assert.ok(readyEventKey({...order,status:'out_for_delivery'}));
 assert.ok(readyEventKey({...order,fulfillment:'pickup'}));
});
