# AMTSWEG – Asset Manifest V1

## Zweck
Dieses Manifest beschreibt die visuellen Assets, die für den ersten produktiven Art-Pass benötigt werden. Die finale Pixelauflösung wird erst nach Abgleich mit astra-horizontal-world festgelegt.

## Characters

### candidate/
- candidate_idle
- candidate_walk_1
- candidate_walk_2
- candidate_talk
- candidate_work
- candidate_hand_flyer
- candidate_phone

### helpers/
- helper_m_idle
- helper_m_walk_1
- helper_m_walk_2
- helper_m_work_1
- helper_m_work_2
- helper_m_hand_flyer
- helper_f_idle
- helper_f_walk_1
- helper_f_walk_2
- helper_f_work_1
- helper_f_work_2
- helper_f_hand_flyer

### pedestrians/
- pedestrian_m_01_idle
- pedestrian_m_01_walk_1
- pedestrian_m_01_walk_2
- pedestrian_f_01_idle
- pedestrian_f_01_walk_1
- pedestrian_f_01_walk_2
- pedestrian_receive_flyer

### office-staff/
- office_staff_01_idle
- office_staff_01_laptop
- office_staff_01_phone
- office_staff_02_idle
- office_staff_02_work

## Campaign stand
- stand_level_01
- stand_level_03
- stand_level_05
- stand_level_10
- stand_level_20
- flyer_stack
- clipboard
- poster_board
- rollup
- banner
- campaign_light
- material_box

## District office
- office_locked
- office_build_01
- office_build_02
- office_active
- office_window_glow
- office_desk
- office_monitor
- office_phone
- office_files
- office_whiteboard
- office_plant

## Street / environment
- sidewalk_tile
- curb_tile
- road_tile
- street_lamp
- bike_rack
- bicycle
- bench
- tree_01
- planter
- mailbox
- street_sign
- small_shop_front
- residential_front

## Naming
Dateinamen folgen: category_subject_variant_state.ext

Beispiele:
- char_candidate_default_idle.png
- char_helper_f_01_walk_1.png
- env_campaign_stand_level_05.png
- env_district_office_build_02.png

## Integrationsregel
Dieser Branch enthält zunächst nur Design-/Asset-Vorbereitung. Keine produktive Kopplung an die alte main-Welt. Integration erfolgt erst nach Abgleich mit dem neuen Astra-Renderer.
