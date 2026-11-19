-- Part 8: sample data for the Daftar showcase (fictional companies, people and figures)
-- Al Noor Logistics and Trading LLC (key al-noor, also the Transport division) and Sahil Technical Services LLC (key sahil).
-- Safe to run once on an empty database after parts 01 to 07.

do $$
declare
  d record; v uuid; s uuid; acc uuid; acc2 uuid; cash uuid; cat uuid; it uuid; ba uuid;
  i int; dt date; r numeric; drv uuid[]; staff_ids uuid[]; m date;
  routes text[][] := array[
    ['Sohar Port','Muscat (Rusayl)'],['Muscat (Mabela)','Sohar Industrial'],['Sohar Port','Nizwa'],['Muscat','Duqm Port'],
    ['Sohar','Jebel Ali (UAE)'],['Muscat (Ghala)','Salalah'],['Barka','Ibri'],['Sohar Port','Buraimi'],['Muscat','Sur'],['Sohar Freezone','Muscat (Misfah)']];
  rents numeric[] := array[95,85,140,260,220,330,120,110,130,90];
  customers text[] := array['Gulf Steel Trading LLC','Oman Cement Supplies','Blue Wave Foods','Desert Rose Construction','Majan Building Materials'];
  cargos text[] := array['Steel coils','Cement bags','Frozen food (reefer)','Construction material','Timber','Tiles'];
begin
  perform setseed(0.42);

  -- ===================== Transport: drivers, vehicles =====================
  for d in select * from (values
    ('Imran Khan','AN 4521',1,'Active',350,40,60,10),
    ('Rashid Al Balushi','AN 7783',2,'Active',380,40,60,10),
    ('Suresh Kumar','AN 3390',3,'Active',320,30,50,10),
    ('Bilal Ahmed','AN 6612',4,'Active',330,30,50,10)) t(name,veh,srt,st,sal,allow,rent,util) loop
    insert into transport_drivers (name, vehicle_no, sort, status, phone, company, salary, allowances, house_rent, utilities,
      resident_card, resident_card_expiry, visa_expiry, passport, contract)
    values (d.name, d.veh, d.srt, d.st, '+968 9' || (1000000 + floor(random()*8999999))::int, 'al-noor', d.sal, d.allow, d.rent, d.util,
      (110000000 + floor(random()*8999999))::int::text, date '2026-12-05' + (d.srt * 70), date '2026-12-20' + (d.srt * 65),
      'P' || (1000000 + floor(random()*8999999))::int, '2 years') returning id into v;
    drv := drv || v;
    insert into transport_vehicles (part, name, model, plate_no, ownership, driver_id, insurance_issue, insurance_expiry, mulkiya_issue, mulkiya_expiry, voc_expiry, sort)
    values ('Unit', case d.srt when 1 then 'Mercedes Actros' when 2 then 'Volvo FH' when 3 then 'MAN TGS' else 'Isuzu Giga' end,
      (2018 + d.srt)::text, d.veh, 'Own', v, date '2026-01-10' + d.srt*30, date '2027-01-09' + d.srt*30,
      date '2026-02-01' + d.srt*20, case d.srt when 1 then date '2026-12-02' else date '2027-02-01' + d.srt*20 end,
      date '2027-03-15' + d.srt*10, d.srt) returning id into s;
    insert into vehicle_maintenance (vehicle_id, work, work_date, amount, payment_method, status, paid_to, next_due)
    values (s, case d.srt when 1 then 'Oil and filter change' when 2 then 'New tyres (2)' when 3 then 'Brake pads' else 'AC repair' end,
      date '2026-09-20' + d.srt*12, case d.srt when 1 then 45 when 2 then 360 when 3 then 85 else 120 end,
      case when d.srt = 2 then 'PDC' else 'Bank Transfer' end, case when d.srt = 2 then 'Pending' else 'Paid' end,
      'Al Wadi Auto Garage', date '2026-12-20' + d.srt*15);
  end loop;
  insert into transport_vehicles (part, name, model, plate_no, ownership, trailer_type, insurance_expiry, mulkiya_expiry, sort)
  values ('Trailer', 'Flatbed 40 ft', '2020', 'AN T-101', 'Own', 'Flatbed', '2027-04-01', '2027-04-01', 5),
         ('Trailer', 'Reefer 40 ft', '2022', 'AN T-102', 'Rent', 'Reefer', '2027-06-15', '2027-06-15', 6);

  -- trips: September to 18 November 2026
  for i in 1..46 loop
    dt := date '2026-09-01' + floor(random()*78)::int;
    r := rents[1 + (i % 10)];
    insert into transport_entries (driver_id, entry_date, from_place, to_place, customer, cargo, consignee, rent, received, payment_status,
      driver_allowance, allowance_status, diesel, toll, maintenance, remarks, entered_by, sort, trip_completed, completed_at, completed_by, completed_role)
    values (drv[1 + (i % 4)], dt, routes[1 + (i % 10)][1], routes[1 + (i % 10)][2], customers[1 + (i % 5)], cargos[1 + (i % 6)],
      customers[1 + ((i+2) % 5)], r,
      case when dt < date '2026-10-15' then r when i % 3 = 0 then round(r/2) else 0 end,
      case when dt < date '2026-10-15' then 'Received' when i % 3 = 0 then 'Partly received' else 'Not Received' end,
      case when r > 200 then 15 else 8 end, case when dt < date '2026-11-01' then 'Paid' else 'Not paid' end,
      round((r * 0.22)::numeric, 3), case when i % 5 = 0 then 2.5 else 0 end, case when i % 17 = 0 then 25 else 0 end,
      case when dt < date '2026-11-15' then 'Completed' else null end, 'Office', i,
      dt < date '2026-11-15', case when dt < date '2026-11-15' then dt + time '18:00' end,
      case when dt < date '2026-11-15' then 'Office' end, case when dt < date '2026-11-15' then 'office' end);
  end loop;

  -- driver salaries September and October (paid), November (not paid yet)
  foreach v in array drv loop
    foreach m in array array[date '2026-09-01', date '2026-10-01', date '2026-11-01'] loop
      insert into transport_salaries (driver_id, month, basic, room_rent, utilities, mobile, travel_food, advance_deduction, special_allowance, paid_amount, paid_on)
      select v, m, t.salary, t.house_rent, t.utilities, 5, 20, case when m = date '2026-10-01' then 50 else 0 end, 0,
        case when m < date '2026-11-01' then t.salary + t.house_rent + t.utilities + 25 - case when m = date '2026-10-01' then 50 else 0 end end,
        case when m < date '2026-11-01' then (m + interval '1 month' + interval '2 days')::date end
      from transport_drivers t where t.id = v;
    end loop;
  end loop;
  insert into transport_extras (driver_id, month, description, amount) values
    (drv[1], '2026-10-01', 'Parking fine Sohar', 20), (drv[3], '2026-11-01', 'Truck wash (monthly)', 15);
  insert into transport_profit_taken (driver_id, taken_on, amount, note, entered_by) values (drv[1], '2026-10-31', 300, 'Owner drawing', 'Office');

  -- transport invoices
  insert into transport_invoices (kind, invoice_no, invoice_date, customer, from_place, to_place, project, bill_address, client_vat, items, delivery, signatory, created_by, status, payment_text, due_text)
  values
  ('tax', 'ANT-2026-031', '2026-09-30', 'Gulf Steel Trading LLC', 'Sohar Port', 'Muscat (Rusayl)', 'Steel coil deliveries September', 'P.O. Box 55, PC 322, Sohar', 'OM1100123456',
   '[{"description":"Transport Sohar Port to Rusayl, 40 ft trailer","qty":"6","unit":"Trip","rate":"95"},{"description":"Waiting charges","qty":"2","unit":"Day","rate":"25"}]', '[]', 'Faisal', 'Office', 'Paid', 'Bank transfer', '30 days'),
  ('tax', 'ANT-2026-032', '2026-10-31', 'Desert Rose Construction', 'Muscat', 'Duqm Port', 'Construction material October', 'P.O. Box 812, PC 111, Seeb', 'OM1100654321',
   '[{"description":"Transport Muscat to Duqm, flatbed","qty":"4","unit":"Trip","rate":"260"}]', '[]', 'Faisal', 'Office', 'Not paid', 'Bank transfer', '45 days'),
  ('invoice', 'ANT-2026-033', '2026-11-15', 'Blue Wave Foods', 'Sohar Freezone', 'Muscat (Misfah)', 'Reefer deliveries', 'Misfah Industrial, Muscat', '',
   '[{"vehicle":"AN 7783","container":"BWFU 220145","description":"Reefer trip Sohar Freezone to Misfah","amount":"90"},{"vehicle":"AN 3390","container":"BWFU 220188","description":"Reefer trip Sohar Freezone to Misfah","amount":"90"}]',
   '[{"vehicle":"AN 7783","container":"BWFU 220145","driver":"Rashid Al Balushi","consignee":"Blue Wave Foods","received_by":"Store keeper"}]', 'Faisal', 'Office', 'Not paid', 'Cash or cheque', '15 days');

  -- ===================== Staff (office and site) =====================
  for d in select * from (values
    ('al-noor','Faisal Al Habsi','Operations Manager','Admin / Office','Office',850,0,150,30,true),
    ('al-noor','Mariam Al Lawati','Accountant','Admin / Office','Office',520,0,100,20,true),
    ('al-noor','Joseph Mathew','Fleet Supervisor','Transport','Site',450,0,80,20,true),
    ('al-noor','Arif Hussain','Mechanic','Transport','Site',280,0,60,10,false),
    ('al-noor','Nasser Al Rashdi','PRO','Admin / Office','Office',400,0,0,0,true),
    ('al-noor','Ramesh Pillai','Store Keeper','Admin / Office','Site',260,0,50,10,false),
    ('sahil','Ahmed Al Siyabi','General Manager','Admin / Office','Office',1100,0,200,40,true),
    ('sahil','Priya Nair','Sales Executive','Marketing','Office',480,0,100,20,true),
    ('sahil','Tariq Mahmood','Site Engineer','Construction','Site',650,0,120,25,true),
    ('sahil','Ravi Shankar','Electrician','Construction','Site',300,0,60,10,false),
    ('sahil','Khalil Ibrahim','IT Technician','IT','Office',420,0,80,15,true)) t(co,name,des,dept,typ,basic,allow,rent,util,tr) loop
    insert into exp_staff (company, name, designation, department, staff_type, basic, allowances, house_rent, utilities, transport_allow,
      working_days, deductions, mobile, passport, resident_card, resident_card_expiry, visa_expiry, contract, sort)
    values (d.co, d.name, d.des, d.dept, d.typ, d.basic, d.allow, d.rent, d.util, d.tr, 30, 0,
      '+968 9' || (1000000 + floor(random()*8999999))::int, 'P' || (1000000 + floor(random()*8999999))::int,
      (110000000 + floor(random()*8999999))::int::text, date '2026-11-28' + floor(random()*400)::int, date '2027-01-10' + floor(random()*400)::int,
      '2 years', 0) returning id into s;
    staff_ids := staff_ids || s;
  end loop;

  -- attendance: October (full month) and November up to the 18th; Friday = weekend (not marked)
  for d in select id, company from exp_staff loop
    for dt in select g::date from generate_series(date '2026-10-01', date '2026-11-18', interval '1 day') g loop
      continue when extract(dow from dt) = 5;
      insert into exp_attendance (company, staff_id, day, mark, entered_by)
      values (d.company, d.id, dt, case when random() < 0.04 then 'A' when random() < 0.04 then 'H' when random() < 0.03 then 'L' else 'P' end, 'Office');
    end loop;
  end loop;

  -- approved salary slips for October 2026
  insert into salary_slips (person_kind, person_id, month, company, name, designation, staff_type, basic, house_rent, utilities, other_allow,
    transport_allow, earnings, monthly, pay_days, absent, half, leave, gross, deductions, deduction_total, net, status, generated_by, approved_at, approved_by)
  select 'staff', s.id, '2026-10', s.company, s.name, s.designation, s.staff_type, s.basic, s.house_rent, s.utilities, 0, s.transport_allow,
    jsonb_build_array(jsonb_build_object('label','Basic','amount',s.basic), jsonb_build_object('label','House rent','amount',s.house_rent), jsonb_build_object('label','Utilities','amount',s.utilities)),
    s.basic + s.house_rent + s.utilities, 30 - a.ab - a.hf * 0.5, a.ab, a.hf, a.lv, s.basic + s.house_rent + s.utilities,
    jsonb_build_array(jsonb_build_object('label','Unpaid days (attendance)','amount', round((s.basic + s.house_rent + s.utilities) / 30 * (a.ab + a.hf * 0.5), 3), 'auto', true)),
    round((s.basic + s.house_rent + s.utilities) / 30 * (a.ab + a.hf * 0.5), 3),
    round(s.basic + s.house_rent + s.utilities - (s.basic + s.house_rent + s.utilities) / 30 * (a.ab + a.hf * 0.5), 3),
    'approved', 'Mariam Al Lawati', timestamptz '2026-11-02 10:00+04', 'Khalid Nasser'
  from exp_staff s cross join lateral (
    select count(*) filter (where mark = 'A') ab, count(*) filter (where mark = 'H') hf, count(*) filter (where mark = 'L') lv
    from exp_attendance x where x.staff_id = s.id and x.day between '2026-10-01' and '2026-10-31') a;
  insert into salary_credits (person_kind, person_id, month, amount, paid_by)
  select 'staff', person_id, month, net, 'Mariam Al Lawati' from salary_slips where month = '2026-10';
  update exp_staff set paid_amount = basic + house_rent + utilities, paid_on = '2026-11-03', attendance_month = '2026-11';

  insert into personnel_subcontractors (name, company_name, contract, contact, company, sort) values
    ('Hassan Ali', 'Al Hassan Loading Services', 'Loading / unloading per trip', '+968 9123 4567', 'al-noor', 1),
    ('Vinod Menon', 'Coastline Electrical Works', 'Electrical works per job', '+968 9876 5432', 'sahil', 1);

  -- ===================== Bills (purchases) and invoices (sales) =====================
  insert into company_docs (company, kind, doc_no, doc_date, party, party_vat, items, vat_pct, payment_method, department, head, category, created_by, verify, approval) values
  ('al-noor','receipt','PR-AN-0001','2026-09-03','Muscat Office Towers LLC','OM1100200100','[{"desc":"Office rent September","amount":450}]',5,'Bank Transfer','Admin / Office','Office Expenses','Office','Mariam Al Lawati','{"status":"verified","by":"Faisal","at":"2026-09-04T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-09-05T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0002','2026-09-08','Shell Oman Marketing','OM1100300200','[{"desc":"Diesel for trucks (fuel card)","amount":620}]',5,'Card','Transport','Vehicle Running and Maintenance','Petrol','Mariam Al Lawati','{"status":"verified","by":"Faisal","at":"2026-09-09T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-09-10T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0003','2026-09-15','Omantel','OM1100000100','[{"desc":"Mobile and internet September","amount":96.5}]',5,'Bank Transfer','Admin / Office','Mobile Telephone and Internet','Internet','Mariam Al Lawati','{"status":"verified","by":"Faisal","at":"2026-09-16T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-09-17T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0004','2026-09-22','Ministry of Labour','','[{"desc":"Labour card renewal (2)","amount":201}]',0,'Card','Admin / Office','Govt Fees, Registration and Renewals','Documentation','Nasser Al Rashdi','{"status":"verified","by":"Faisal","at":"2026-09-23T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-09-24T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0005','2026-10-02','Muscat Office Towers LLC','OM1100200100','[{"desc":"Office rent October","amount":450}]',5,'Bank Transfer','Admin / Office','Office Expenses','Office','Mariam Al Lawati','{"status":"verified","by":"Faisal","at":"2026-10-03T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-10-04T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0006','2026-10-09','Al Wadi Auto Garage','OM1100400300','[{"desc":"Truck service AN 4521","amount":180},{"desc":"Spare parts","amount":95}]',5,'Cash','Transport','Vehicle Running and Maintenance','Car service','Joseph Mathew','{"status":"verified","by":"Faisal","at":"2026-10-10T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-10-11T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0007','2026-10-14','Lulu Hypermarket','OM1100500400','[{"desc":"Office pantry items","amount":38.75}]',5,'Cash','Admin / Office','Office Expenses','Food','Ramesh Pillai','{"status":"verified","by":"Faisal","at":"2026-10-15T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-10-16T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0008','2026-10-20','Nama Electricity','','[{"desc":"Electricity October (office and yard)","amount":132.4}]',0,'Bank Transfer','Admin / Office','Utility','Utility','Mariam Al Lawati','{"status":"verified","by":"Faisal","at":"2026-10-21T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-10-22T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0009','2026-10-28','Shell Oman Marketing','OM1100300200','[{"desc":"Diesel for trucks (fuel card)","amount":705}]',5,'Card','Transport','Vehicle Running and Maintenance','Petrol','Mariam Al Lawati','{"status":"verified","by":"Faisal","at":"2026-10-29T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-10-30T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0010','2026-11-02','Muscat Office Towers LLC','OM1100200100','[{"desc":"Office rent November","amount":450}]',5,'Bank Transfer','Admin / Office','Office Expenses','Office','Mariam Al Lawati','{"status":"verified","by":"Faisal","at":"2026-11-03T09:00:00Z"}','{"status":"approved","by":"Khalid Nasser","at":"2026-11-04T09:00:00Z"}'),
  ('al-noor','receipt','PR-AN-0011','2026-11-06','Jarir Bookstore','OM1100600500','[{"desc":"Printer toner and A4 paper","amount":64}]',5,'Cash','Admin / Office','Office Expenses','Stationary','Ramesh Pillai','{"status":"verified","by":"Faisal","at":"2026-11-07T09:00:00Z"}',null),
  ('al-noor','receipt','PR-AN-0012','2026-11-10','Digital Marketing Hub','OM1100700600','[{"desc":"Social media ads November","amount":150}]',5,'Bank Transfer','Admin / Office','Marketing','Marketing','Faisal Al Habsi','{"status":"verified","by":"Faisal","at":"2026-11-11T09:00:00Z"}',null),
  ('al-noor','receipt','PR-AN-0013','2026-11-13','Shell Oman Marketing','OM1100300200','[{"desc":"Diesel for trucks (fuel card)","amount":410}]',5,'Card','Transport','Vehicle Running and Maintenance','Petrol','Mariam Al Lawati',null,null),
  ('al-noor','receipt','PR-AN-0014','2026-11-16','Royal Oman Police','','[{"desc":"Mulkiya renewal AN 4521","amount":75}]',0,'Card','Transport','Govt Fees, Registration and Renewals','Documentation','Nasser Al Rashdi',null,null),
  ('al-noor','invoice','INV-AN-0001','2026-09-30','Gulf Steel Trading LLC','OM1100123456','[{"desc":"Transport services September (6 trips Sohar Port to Rusayl)","amount":570},{"desc":"Waiting charges","amount":50}]',5,null,'Transport',null,null,'Mariam Al Lawati',null,null),
  ('al-noor','invoice','INV-AN-0002','2026-10-15','Oman Cement Supplies','OM1100223344','[{"desc":"Transport services, cement bags to Sohar Industrial","amount":510}]',5,null,'Transport',null,null,'Mariam Al Lawati',null,null),
  ('al-noor','invoice','INV-AN-0003','2026-10-31','Desert Rose Construction','OM1100654321','[{"desc":"Transport Muscat to Duqm (4 trips)","amount":1040}]',5,null,'Transport',null,null,'Mariam Al Lawati',null,null),
  ('al-noor','invoice','INV-AN-0004','2026-11-12','Majan Building Materials','OM1100998877','[{"desc":"Trading: 200 bags white cement","amount":640},{"desc":"Delivery","amount":40}]',5,null,'Admin / Office',null,null,'Mariam Al Lawati',null,null),
  ('al-noor','invoice','INV-AN-0005','2026-11-17','Blue Wave Foods','OM1100445566','[{"desc":"Reefer transport Sohar Freezone to Misfah (2 trips)","amount":180}]',5,null,'Transport',null,null,'Mariam Al Lawati',null,null),
  ('sahil','receipt','PR-SH-0001','2026-09-05','Azaiba Business Center','OM1100800700','[{"desc":"Office rent September","amount":380}]',5,'Bank Transfer','Admin / Office','Office Expenses','Office','Ahmed Al Siyabi','{"status":"verified","by":"Hamad","at":"2026-09-06T09:00:00Z"}','{"status":"approved","by":"Salim","at":"2026-09-07T09:00:00Z"}'),
  ('sahil','receipt','PR-SH-0002','2026-09-18','Muscat Electrical Supplies','OM1100900800','[{"desc":"Cables and switchgear for Villa project","amount":1240}]',5,'Cheque','Construction','Office Expenses','Building Material','Tariq Mahmood','{"status":"verified","by":"Hamad","at":"2026-09-19T09:00:00Z"}','{"status":"approved","by":"Salim","at":"2026-09-20T09:00:00Z"}'),
  ('sahil','receipt','PR-SH-0003','2026-10-05','Azaiba Business Center','OM1100800700','[{"desc":"Office rent October","amount":380}]',5,'Bank Transfer','Admin / Office','Office Expenses','Office','Ahmed Al Siyabi','{"status":"verified","by":"Hamad","at":"2026-10-06T09:00:00Z"}','{"status":"approved","by":"Salim","at":"2026-10-07T09:00:00Z"}'),
  ('sahil','receipt','PR-SH-0004','2026-10-22','Ooredoo','OM1100000200','[{"desc":"Mobile lines October","amount":72}]',5,'Bank Transfer','IT','Mobile Telephone and Internet','Mobile','Khalil Ibrahim','{"status":"verified","by":"Hamad","at":"2026-10-23T09:00:00Z"}',null),
  ('sahil','receipt','PR-SH-0005','2026-11-05','Azaiba Business Center','OM1100800700','[{"desc":"Office rent November","amount":380}]',5,'Bank Transfer','Admin / Office','Office Expenses','Office','Ahmed Al Siyabi',null,null),
  ('sahil','receipt','PR-SH-0006','2026-11-12','Dell Middle East','OM1101000900','[{"desc":"2 laptops for site engineers","amount":760}]',5,'Card','IT','IT, Mobile and Computer','Electronics','Khalil Ibrahim',null,null),
  ('sahil','invoice','INV-SH-0001','2026-09-28','Al Bustan Villas Project','OM1101111000','[{"desc":"Electrical works stage 1 (Villa 4 to 7)","amount":2800}]',5,null,'Construction',null,null,'Priya Nair',null,null),
  ('sahil','invoice','INV-SH-0002','2026-10-25','Seeb Medical Clinic','OM1101222000','[{"desc":"AC maintenance contract (quarter)","amount":900},{"desc":"Spare parts","amount":120}]',5,null,'Construction',null,null,'Priya Nair',null,null),
  ('sahil','invoice','INV-SH-0003','2026-11-14','Al Bustan Villas Project','OM1101111000','[{"desc":"Electrical works stage 2 (Villa 8 to 12)","amount":3500}]',5,null,'Construction',null,null,'Priya Nair',null,null);
  update company_docs set party_details = 'Muscat, Sultanate of Oman', signatory = case company when 'al-noor' then 'Faisal Al Habsi' else 'Ahmed Al Siyabi' end where kind = 'invoice';

  -- other expense lines typed in the expense sheet
  insert into exp_entries (company, department, entry_date, bill_no, description, category, head, paid, unpaid, vat, account, entered_by) values
  ('al-noor','Admin / Office','2026-09-12','W-221','Drinking water (20 bottles)','Water','Office Expenses',12,null,null,'P & L','Ramesh Pillai'),
  ('al-noor','Admin / Office','2026-10-12','W-245','Drinking water (20 bottles)','Water','Office Expenses',12,null,null,'P & L','Ramesh Pillai'),
  ('al-noor','Admin / Office','2026-11-12','W-270','Drinking water (20 bottles)','Water','Office Expenses',12,null,null,'P & L','Ramesh Pillai'),
  ('al-noor','Admin / Office','2026-10-18','E-88','Client lunch (Gulf Steel)','Food','Entertainment',28.5,null,null,'P & L','Faisal Al Habsi'),
  ('al-noor','Admin / Office','2026-11-08','CR-2026','CR renewal fee','Documentation','Govt Fees, Registration and Renewals',0,120,null,'P & L','Nasser Al Rashdi'),
  ('sahil','Admin / Office','2026-10-03','CC-12','Chamber of Commerce membership','Documentation','Govt Fees, Registration and Renewals',150,null,null,'P & L','Ahmed Al Siyabi'),
  ('sahil','Marketing','2026-11-01','BR-9','Company brochures printing','Marketing','Marketing',85,null,4.25,'P & L','Priya Nair');

  insert into exp_budgets (source, head, monthly) values
    ('al-noor','Office Expenses',700),('al-noor','Vehicle Running and Maintenance',1800),('al-noor','Salary',5000),('al-noor','Utility',200),('al-noor','Marketing',200),('al-noor','Mobile Telephone and Internet',120),
    ('sahil','Office Expenses',600),('sahil','Salary',4200),('sahil','Marketing',150),('sahil','IT, Mobile and Computer',300);

  -- ===================== Petty cash =====================
  insert into petty_cash (company, date, kind, voucher, description, party, category, amount, created_by) values
  ('al-noor','2026-10-01','in','PC-001','Cash from bank for petty cash','Bank Muscat','Cash in',300,'Mariam Al Lawati'),
  ('al-noor','2026-10-04','out','PC-002','Tea, sugar, milk powder','Lulu Hypermarket','Food',14.25,'Ramesh Pillai'),
  ('al-noor','2026-10-09','out','PC-003','Courier documents to Sohar','Aramex','Documentation',6,'Nasser Al Rashdi'),
  ('al-noor','2026-10-16','out','PC-004','Truck wash AN 7783','Sohar Car Wash','Car service',5,'Joseph Mathew'),
  ('al-noor','2026-10-23','out','PC-005','Toilet rolls, Dettol, garbage bags','Al Meera','Office',11.8,'Ramesh Pillai'),
  ('al-noor','2026-11-01','in','PC-006','Cash from bank for petty cash','Bank Muscat','Cash in',200,'Mariam Al Lawati'),
  ('al-noor','2026-11-05','out','PC-007','Taxi for PRO to ministry','Otaxi','Misc',7.5,'Nasser Al Rashdi'),
  ('al-noor','2026-11-11','out','PC-008','Printer paper and pens','Jarir Bookstore','Stationary',9.6,'Ramesh Pillai'),
  ('al-noor','2026-11-15','out','PC-009','Staff lunch (overtime)','Turkish House Restaurant','Food',18,'Faisal Al Habsi'),
  ('sahil','2026-10-02','in','PC-001','Cash from bank for petty cash','Sohar International','Cash in',150,'Ahmed Al Siyabi'),
  ('sahil','2026-10-10','out','PC-002','Site drinking water','Tanuf','Water',8,'Tariq Mahmood'),
  ('sahil','2026-10-27','out','PC-003','Electrical tape and fuses','Muscat Electrical Supplies','Building Material',12.4,'Ravi Shankar'),
  ('sahil','2026-11-09','out','PC-004','Parking at client site','Muscat Municipality','Misc',3,'Priya Nair');

  -- ===================== Accounts (bank, cash, assets, loans) =====================
  insert into acc_accounts (company, name, kind, bank_name, account_no, opening_balance, opening_date, sort) values
    ('al-noor','Bank Muscat Current','Bank','Bank Muscat','0310-XXXX-4401',18500,'2026-09-01',1) returning id into acc;
  insert into acc_accounts (company, name, kind, bank_name, account_no, opening_balance, opening_date, sort) values
    ('al-noor','NBO Savings','Bank','National Bank of Oman','1200-XXXX-8820',25000,'2026-09-01',2) returning id into acc2;
  insert into acc_accounts (company, name, kind, opening_balance, opening_date, sort) values
    ('al-noor','Office cash','Cash',650,'2026-09-01',3) returning id into cash;
  insert into acc_txns (account_id, txn_date, description, party, ref, category, money_in, money_out, cleared, entered_by) values
    (acc,'2026-09-03','Office rent September','Muscat Office Towers LLC','PR-AN-0001','Rent',0,472.5,true,'Mariam Al Lawati'),
    (acc,'2026-09-12','Payment received INV July','Gulf Steel Trading LLC','TT-5521','Sales',1850,0,true,'Mariam Al Lawati'),
    (acc,'2026-10-02','Office rent October','Muscat Office Towers LLC','PR-AN-0005','Rent',0,472.5,true,'Mariam Al Lawati'),
    (acc,'2026-10-03','Salaries September','Staff and drivers','WPS-09','Salary',0,4920,true,'Mariam Al Lawati'),
    (acc,'2026-10-15','Payment received INV-AN-0001','Gulf Steel Trading LLC','TT-5604','Sales',651,0,true,'Mariam Al Lawati'),
    (acc,'2026-10-20','Electricity October','Nama Electricity','EB-10','Utility',0,132.4,true,'Mariam Al Lawati'),
    (acc,'2026-10-30','Fuel card top up','Shell Oman Marketing','FC-10','Fuel',0,1391.25,true,'Mariam Al Lawati'),
    (acc,'2026-11-02','Office rent November','Muscat Office Towers LLC','PR-AN-0005','Rent',0,472.5,true,'Mariam Al Lawati'),
    (acc,'2026-11-03','Salaries October','Staff and drivers','WPS-10','Salary',0,4870,true,'Mariam Al Lawati'),
    (acc,'2026-11-10','Payment received INV-AN-0002','Oman Cement Supplies','CHQ 220014','Sales',535.5,0,false,'Mariam Al Lawati'),
    (acc2,'2026-09-30','Profit on savings','National Bank of Oman','INT-09','Interest',41.6,0,true,'Mariam Al Lawati'),
    (acc2,'2026-10-31','Profit on savings','National Bank of Oman','INT-10','Interest',42.1,0,true,'Mariam Al Lawati'),
    (cash,'2026-10-01','To petty cash','Petty cash','PC-001','Transfer',0,300,true,'Mariam Al Lawati'),
    (cash,'2026-11-01','To petty cash','Petty cash','PC-006','Transfer',0,200,true,'Mariam Al Lawati');
  insert into acc_accounts (company, name, kind, bank_name, account_no, opening_balance, opening_date, sort) values
    ('sahil','Sohar International Current','Bank','Sohar International','0450-XXXX-1177',12400,'2026-09-01',1) returning id into acc;
  insert into acc_txns (account_id, txn_date, description, party, ref, category, money_in, money_out, cleared, entered_by) values
    (acc,'2026-09-05','Office rent September','Azaiba Business Center','PR-SH-0001','Rent',0,399,true,'Ahmed Al Siyabi'),
    (acc,'2026-10-12','Payment received INV-SH-0001','Al Bustan Villas Project','TT-8801','Sales',2940,0,true,'Ahmed Al Siyabi'),
    (acc,'2026-11-03','Salaries October','Staff','WPS-10','Salary',0,3790,true,'Ahmed Al Siyabi');
  insert into acc_items (company, side, name, amount, as_of, notes, sort) values
    ('al-noor','asset','Vehicles',96000,'2026-09-01','4 trucks (book value)',1),
    ('al-noor','asset','Trailers',18000,'2026-09-01','2 trailers',2),
    ('al-noor','asset','Furniture',4200,'2026-09-01','Office furniture',3),
    ('al-noor','asset','Deposit paid',1350,'2026-09-01','Office rent deposit',4),
    ('al-noor','liability','Vehicle loan (Bank Muscat)',38500,'2026-09-01','60 months',5),
    ('al-noor','equity','Owner capital',100000,'2026-09-01','',6),
    ('sahil','asset','Equipment',14500,'2026-09-01','Tools and testers',1),
    ('sahil','asset','Computers',3800,'2026-09-01','',2),
    ('sahil','equity','Owner capital',30000,'2026-09-01','',3);

  -- ===================== Inventory (office supplies, kitchen, sanitary) =====================
  for d in select * from (values
    ('Office Supplies', 1, array['A4 paper (ream)','Staplers','Pens (box)','Pencils (box)','Punching machine','File folders','Toner cartridge','Sticky notes','Envelopes','Clips and pins','Batteries (AA)','Light bulbs']),
    ('Kitchen', 2, array['Drinking water (5 gal)','Sugar (kg)','Tea bags (box)','Coffee (jar)','Milk powder (tin)','Green tea (box)','Plastic spoons (pack)','Paper cups (pack)']),
    ('Sanitary', 3, array['Toilet rolls (pack)','Tissue paper (box)','Dettol (bottle)','Clorox (bottle)','Mop','Garbage bags (roll)','Room freshener','Hand wash (bottle)'])) t(nm, srt, items) loop
    insert into categories (name, sort, company) values (d.nm, d.srt, null) returning id into cat;
    for i in 1..array_length(d.items,1) loop
      insert into items (category_id, name, unit, quantity, min_qty, sort, per_pack, price)
      values (cat, d.items[i], 'pcs', 0, case when i % 4 = 0 then 5 else 3 end, i, 1, round((0.5 + random()*6)::numeric, 3)) returning id into it;
      perform record_move(it, 'in', 6 + floor(random()*20)::int, 'Opening stock');
      if random() < 0.85 then perform record_move(it, 'out', 1 + floor(random()*5)::int, 'Used in office'); end if;
    end loop;
  end loop;
  update items set quantity = 2 where name in ('Toner cartridge','Sugar (kg)','Toilet rolls (pack)');
  -- Al Noor's own inventory (yard and workshop)
  insert into categories (name, sort, company) values ('Workshop', 1, 'al-noor') returning id into cat;
  for d in select * from (values ('Engine oil (20 L)',8,3,18.5),('Grease (kg)',12,4,2.2),('Air filter',5,2,9.5),('Wiper blades',6,2,3.75),('Tyre valve',20,5,0.4)) t(nm,q,mn,pr) loop
    insert into items (category_id, name, unit, quantity, min_qty, per_pack, price) values (cat, d.nm, 'pcs', 0, d.mn, 1, d.pr) returning id into it;
    perform record_move(it, 'in', d.q, 'Purchased');
  end loop;
  insert into categories (name, sort, company) values ('Site tools', 1, 'sahil') returning id into cat;
  for d in select * from (values ('Cable 2.5 mm (roll)',10,3,14),('Switch sockets',40,10,1.8),('MCB 32A',15,5,3.4),('Safety helmets',12,4,2.5)) t(nm,q,mn,pr) loop
    insert into items (category_id, name, unit, quantity, min_qty, per_pack, price) values (cat, d.nm, 'pcs', 0, d.mn, 1, d.pr) returning id into it;
    perform record_move(it, 'in', d.q, 'Purchased');
  end loop;

  -- utility bills (prepaid / postpaid) with payments
  for d in select * from (values ('Electricity','Postpaid','EL-55120',1,132.4),('Water','Postpaid','WA-22091',2,38),('Water dispenser','Prepaid','DS-7781',3,12),('Internet (fiber)','Postpaid','IN-90031',4,42)) t(nm,pt,no,srt,amt) loop
    insert into bill_accounts (name, payment_type, account_no, sort, company) values (d.nm, d.pt, d.no, d.srt, null) returning id into ba;
    insert into bill_payments (account_id, amount, paid_on, period, note) values
      (ba, d.amt * 0.95, '2026-09-20', 'Sep 2026', 'Paid online'), (ba, d.amt, '2026-10-20', 'Oct 2026', 'Paid online');
  end loop;

  -- ===================== Documents checklist (expiries drive the alerts) =====================
  insert into doc_checklist (section, owner, doc_name, doc_no, issue_date, expiry_date, sort, entered_by) values
    ('company','Al Noor Logistics and Trading LLC','CR Paper','1000001','2025-12-01','2026-11-30',1,'Nasser Al Rashdi'),
    ('company','Al Noor Logistics and Trading LLC','VAT Certificate','OM1100000001','2023-04-01',null,2,'Nasser Al Rashdi'),
    ('company','Al Noor Logistics and Trading LLC','Chamber of Commerce','CC-22019','2026-01-15','2027-01-14',3,'Nasser Al Rashdi'),
    ('company','Sahil Technical Services LLC','CR Paper','1000002','2026-03-10','2027-03-09',4,'Nasser Al Rashdi'),
    ('company','Al Noor Logistics and Trading LLC','Office Agreement','LEASE-114','2026-01-01','2026-12-31',5,'Nasser Al Rashdi'),
    ('govt','Al Noor Logistics and Trading LLC','Transport License','TL-8821','2025-12-10','2026-12-09',1,'Nasser Al Rashdi'),
    ('govt','Al Noor Logistics and Trading LLC','Municipality License','ML-3302','2026-02-01','2027-01-31',2,'Nasser Al Rashdi'),
    ('govt','Sahil Technical Services LLC','Civil Defence','CD-1180','2026-05-01','2027-04-30',3,'Nasser Al Rashdi'),
    ('heavy','AN 4521 · Imran Khan','Mulkiya (Registration)','MUL-4521','2025-12-03','2026-12-02',1,'Joseph Mathew'),
    ('heavy','AN 4521 · Imran Khan','Insurance','INS-77120','2026-02-09','2027-02-08',2,'Joseph Mathew'),
    ('heavy','AN 7783 · Rashid Al Balushi','VOC','VOC-7783','2026-03-01','2027-02-28',3,'Joseph Mathew'),
    ('car','AN 1209 · Faisal Al Habsi','Mulkiya (Registration)','MUL-1209','2026-01-20','2027-01-19',1,'Joseph Mathew'),
    ('employee','Imran Khan','Driving Licence','DL-55012','2020-06-01','2030-05-31',1,'Nasser Al Rashdi'),
    ('employee','Arif Hussain','Resident Card','RC-110224','2024-11-25','2026-11-24',2,'Nasser Al Rashdi'),
    ('employee','Priya Nair','Visa','VS-88231','2025-12-15','2026-12-14',3,'Nasser Al Rashdi'),
    ('employee','Joseph Mathew','Medical','MED-4410','2026-04-01','2027-03-31',4,'Nasser Al Rashdi');

  -- e-invoice seller details and labels
  insert into app_settings (key, value) values
    ('einv.sellers', '{"al-noor":{"vat":"OM1100000001","name_ar":"النور للخدمات اللوجستية والتجارة ش.م.م"},"sahil":{"vat":"OM1100000002","name_ar":"الساحل للخدمات الفنية ش.م.م"}}')
  on conflict (key) do nothing;
end $$;

-- the audit trail should start clean (sample data is not someone's change)
truncate public.audit_log;
