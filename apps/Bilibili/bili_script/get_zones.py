from bilibili_api import video_zone 
import json
zones= video_zone.get_zone_list_sub()
print(len(zones))
for zone in zones:
    # if zone['name'] == "VLOG":
    #     print(zone)
    print(zone['name'], zone['tid'] if 'tid' in zone else '', zone['route'] if 'route' in zone else '')
    if "sub" in zone:
        for sub in zone["sub"]:
            print("  ", sub['name'], sub['tid'] if 'tid' in sub else '', sub['route'] if 'route' in sub else '')
