alter table mastery_topics add column region text;

alter table mastery_topics add constraint mastery_topics_region_check
  check (region is null or region in (
    'aortic_valve',
    'mitral_valve',
    'right_sided_valves',
    'left_ventricle',
    'right_ventricle',
    'atria',
    'coronary_arteries',
    'aortic_root_great_vessels',
    'pericardium',
    'whole_heart'
  ));
