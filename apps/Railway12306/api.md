12306 API 接口总结

1. 获取车站数据（两步）

第一步：获取 JS 文件路径
•  URL: GET https://www.12306.cn/index/
•  从返回的 HTML 中正则匹配 /script/core/common/station_name_*.js 路径

第二步：下载车站数据
•  URL: GET https://www.12306.cn/script/core/common/station_name_new_v10106.js（路径动态变化）
•  返回: JS 变量赋值，内容是 | 分隔的字符串，每 10 个字段为一组：站ID|站名|站码|拼音|简拼|序号|编码|城市|r1|r2



2. 获取 Cookie

•  URL: GET https://kyfw.12306.cn/otn/leftTicket/init
•  返回 Set-Cookie 头，包含 route、JSESSIONID、BIGipServerotn 三个 Cookie
•  后续所有 kyfw.12306.cn 的请求都需要带上这些 Cookie



3. 余票查询

•  URL: GET https://kyfw.12306.cn/otn/leftTicket/query（实际路径可能被 302 重定向到 queryG/queryZ 等）
•  参数:
◦  leftTicketDTO.train_date — 日期，格式 yyyy-MM-dd
◦  leftTicketDTO.from_station — 出发站码（如 BJP）
◦  leftTicketDTO.to_station — 到达站码（如 SHH）
◦  purpose_codes — 固定 ADULT
•  Headers: Cookie: <从 init 接口获取>
•  返回: JSON，data.result 是字符串数组，每条用 | 分隔 57 个字段（车次、时间、各席别余票数、票价编码等），data.map 是站码→站名的映射



4. 车次搜索

•  URL: GET https://search.12306.cn/search/v1/train/search
•  参数:
◦  keyword — 车次号（如 G1）
◦  date — 日期，格式 yyyyMMdd
•  无需 Cookie
•  返回: JSON，data 数组包含 train_no、station_train_code、from_station、to_station 等



5. 列车经停站查询

•  URL: GET https://kyfw.12306.cn/otn/queryTrainInfo/query
•  参数:
◦  leftTicketDTO.train_no — 车次编号（从车次搜索接口获取，如 24000000G10L）
◦  leftTicketDTO.train_date — 日期，格式 yyyy-MM-dd
◦  rand_code — 空字符串
•  Headers: Cookie: <从 init 接口获取>
•  返回: JSON，data.data 数组，每项包含 station_name、arrive_time、start_time、running_time、station_train_code 等



6. 中转换乘查询（两步）

第一步：获取查询路径
•  URL: GET https://kyfw.12306.cn/otn/lcQuery/init
•  从返回 HTML 中正则匹配 var lc_search_url = '...'，提取实际查询路径（如 /lcquery/queryU）

第二步：查询中转票
•  URL: GET https://kyfw.12306.cn{上一步获取的路径}
•  参数:
◦  train_date — 日期，格式 yyyy-MM-dd
◦  from_station_telecode — 出发站码
◦  to_station_telecode — 到达站码
◦  middle_station — 中转站码（可选，空字符串表示不指定）
◦  result_index — 翻页索引，首次为 0
◦  can_query — 首次为 Y
◦  isShowWZ — 是否显示无座，Y/N
◦  purpose_codes — 00（成人）/ 0X（学生）
◦  channel — 固定 E
•  Headers: Cookie: <从 init 接口获取>
•  返回: JSON，data.middleList 数组包含中转方案，data.can_query 为 N 时无更多结果，否则用返回的 data.result_index 继续翻页



关键注意事项

1. Cookie 必须先拿后用：每次查询前先请求 /otn/leftTicket/init 获取 Cookie
2. 余票查询路径会变：/otn/leftTicket/query 可能 302 到 queryG、queryZ 等，需跟随重定向
3. 中转查询路径也是动态的：需从 /otn/lcQuery/init 页面提取
4. 车站 JS 文件路径带版本号：每次从首页 HTML 提取，不要硬编码
5. 票价解析：在 yp_info_new 字段中，每 10 字符一组——首字符是席别码，1-5 位是价格（需 ÷10），6-9 位 ≥3000 表示无座