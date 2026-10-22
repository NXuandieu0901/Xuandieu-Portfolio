import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helper.js';
import { importSheet } from '../server/import-sheet.js';
test('13 cấp email/mật khẩu cho hồ sơ nhập, giữ nguyên mã và đóng góp',async t=>{
 const f=await fixture(t),a=await f.login();
 importSheet(f.db,{spreadsheetId:'private',title:'Nguồn thử',capturedAt:new Date().toISOString(),roster:[{name:'Thành viên Nhập',code:'IM001'}],transactions:[{row:2,values:[46315,'Quỹ lớp','Thu','Thu quỹ kỳ',300000,'Ví','Thành viên Nhập',true,'IM001']}]});
 const u=f.db.prepare('SELECT id FROM users WHERE code=?').get('IM001');
 let r=await a.request('/api/members/'+u.id,'PATCH',{email:'real@test.local',password:'Provisioned-12345'});
 assert.equal(r.status,200);assert.equal(r.data.code,'IM001');
 assert.equal((await a.request('/api/members/'+u.id,'PATCH',{email:'admin@test.local'})).status,409);
 r=await f.call('/api/login',{method:'POST',body:{email:'real@test.local',password:'Provisioned-12345'}});
 assert.equal(r.status,200);assert.equal(r.data.user.code,'IM001');
 assert.equal(f.db.prepare('SELECT sum(contribution_delta) n FROM transactions WHERE member_id=?').get(u.id).n,300000);
});
