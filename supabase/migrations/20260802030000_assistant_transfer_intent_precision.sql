update public.assistant_knowledge
set phrases = array(
  select distinct phrase
  from unnest(
    phrases || array[
      'como pago por transferencia',
      'como pagar por transferencia',
      'pago por transferencia'
    ]::text[]
  ) as phrase
)
where slug = 'bank-transfer'
  and not phrases @> array[
    'como pago por transferencia',
    'como pagar por transferencia',
    'pago por transferencia'
  ]::text[];
