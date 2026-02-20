alter table public.expense_categories
add column if not exists description text not null default '';

insert into public.expense_categories (name, description, is_active)
values
  ('宜睿票券', '購買或核銷 Edenred 禮券、即享券與員工福利票券。', true),
  ('租金支出', '辦公室、倉儲、設備或場地租賃等固定租金費用。', true),
  ('郵電費', '郵資、快遞、電話、網路與通訊相關費用。', true),
  ('職工福利', '員工聚餐、健康檢查、節慶禮品與員工關懷支出。', true),
  ('手續費', '銀行匯款、金流平台與各類行政處理手續費。', true),
  ('軟體使用費', 'SaaS 訂閱、雲端服務授權與軟體年費。', true),
  ('雜費', '無法歸入既有類別的小額日常營運費用。', true),
  ('保險費', '商業保險、責任險與各類保單保費支出。', true),
  ('交際費', '業務招待、客戶餐敘與對外關係維護支出。', true),
  ('捐贈', '公益捐款、社會責任活動與對外捐贈支出。', true),
  ('佣金支出', '通路或合作夥伴之佣金、介紹費與分潤支出。', true),
  ('訓練費', '內外部教育訓練、課程報名與講師費用。', true),
  ('其他費用', '特殊或一次性支出，需於說明欄補充用途。', true),
  ('雜項購置', '辦公用品、耗材、零星設備採購與補貨。', true),
  ('交通費', '計程車、高鐵、台鐵、機票與通勤交通支出。', true),
  ('勞務費', '短期人力、外包協作與專案勞務對價支出。', true),
  ('執行業務報酬', '依執行業務所得規範支付之報酬與費用。', true),
  ('一般雜支', '一般日常營運費用，無特定專屬類別時使用。', true),
  ('差旅費', '出差交通、住宿、差旅餐費與相關必要支出。', true),
  ('伙食費', '會議便當、加班餐費與業務餐敘之伙食支出。', true)
on conflict (name) do update
set
  description = excluded.description,
  is_active = excluded.is_active;
