export interface SqlPreset {
  name: string
  query: string
}

export const SQL_PRESETS_ROW1: SqlPreset[] = [
  {
    name: 'Deals by sponsor',
    query: `SELECT deal_date, platform_company, pe_sponsor, target_name, target_state, deal_type, deal_size_mm
FROM deals WHERE pe_sponsor = '[EDIT: sponsor name]'
ORDER BY deal_date DESC`,
  },
  {
    name: 'ZIP ownership',
    query: `SELECT zip, city, state,
  SUM(CASE WHEN entity_classification IN ('solo_established','solo_new','solo_inactive','solo_high_volume','family_practice','small_group','large_group') THEN 1 ELSE 0 END) as independent,
  SUM(CASE WHEN entity_classification IN ('dso_regional','dso_national') THEN 1 ELSE 0 END) as corporate,
  SUM(CASE WHEN entity_classification = 'specialist' THEN 1 ELSE 0 END) as specialist,
  SUM(CASE WHEN entity_classification IS NULL AND ownership_status IN ('dso_affiliated','pe_backed') THEN 1 ELSE 0 END) as corporate_by_status_fallback,
  COUNT(*) as total
FROM practices WHERE zip IN (SELECT zip_code FROM watched_zips)
GROUP BY zip, city, state ORDER BY total DESC`,
  },
  {
    name: 'Monthly volume',
    query: `SELECT to_char(deal_date, 'YYYY-MM') as month, deal_type, COUNT(*) as deals
FROM deals GROUP BY month, deal_type ORDER BY month DESC`,
  },
  {
    name: 'New in state',
    query: `SELECT DISTINCT platform_company, pe_sponsor, MIN(deal_date) as first_deal, COUNT(*) as total
FROM deals WHERE target_state='[EDIT: ST]' AND deal_date > current_date - interval '12 months'
GROUP BY platform_company, pe_sponsor ORDER BY first_deal DESC`,
  },
  {
    name: 'Practice changes',
    query: `SELECT pc.change_date, p.practice_name, p.city, p.zip, pc.field_changed,
  pc.old_value, pc.new_value, pc.change_type
FROM practice_changes pc JOIN practices p ON pc.npi=p.npi
WHERE p.zip IN (SELECT zip_code FROM watched_zips)
ORDER BY pc.change_date DESC LIMIT 50`,
  },
]

export const SQL_PRESETS_ROW2: SqlPreset[] = [
  {
    name: 'Saturation Comparison',
    query: `SELECT wz.zip_code, wz.city, wz.population, wz.median_household_income,
  zs.total_gp_locations, zs.total_specialist_locations,
  zs.dld_gp_per_10k, zs.people_per_gp_door,
  zs.buyable_practice_ratio, zs.corporate_share_pct,
  zs.market_type, zs.metrics_confidence,
  zs.data_axle_enrichment_pct
FROM zip_scores zs
JOIN watched_zips wz ON zs.zip_code = wz.zip_code
WHERE wz.metro_area LIKE '%Chicagoland%'
ORDER BY zs.dld_gp_per_10k ASC`,
  },
  {
    name: 'Family Practices',
    query: `SELECT p.zip, p.address, p.practice_name, p.provider_last_name,
  p.entity_classification, p.classification_reasoning,
  p.year_established, p.employee_count
FROM practices p
WHERE p.zip IN (SELECT zip_code FROM watched_zips)
  AND p.entity_classification = 'family_practice'
ORDER BY p.zip, p.address`,
  },
  {
    name: 'High-Vol Solos',
    query: `SELECT p.practice_name, p.address, p.city, p.zip,
  p.year_established, p.employee_count, p.estimated_revenue,
  p.buyability_score, p.ownership_status, p.entity_classification
FROM practices p
WHERE p.zip IN (SELECT zip_code FROM watched_zips)
  AND p.entity_classification = 'solo_high_volume'
ORDER BY p.estimated_revenue DESC NULLS LAST`,
  },
  {
    name: 'Enrichment Coverage',
    query: `SELECT wz.zip_code, wz.city, wz.metro_area,
  COUNT(*) as total_practices,
  SUM(CASE WHEN p.data_axle_import_date IS NOT NULL THEN 1 ELSE 0 END) as enriched,
  ROUND(100.0 * SUM(CASE WHEN p.data_axle_import_date IS NOT NULL THEN 1 ELSE 0 END)::numeric / COUNT(*), 1) as enrichment_pct
FROM watched_zips wz
LEFT JOIN practices p ON p.zip = wz.zip_code
GROUP BY wz.zip_code, wz.city, wz.metro_area
ORDER BY enrichment_pct DESC`,
  },
]
