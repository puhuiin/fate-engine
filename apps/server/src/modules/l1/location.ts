/** L1 城市经纬度库（内置常用城市，东经正 / 北纬正 / 东八区默认）。 */

export interface City {
  name: string;
  province: string;
  longitude: number;
  latitude: number;
  timezoneOffset: number;
}

export const CITIES: City[] = [
  { name: '北京', province: '北京市', longitude: 116.4074, latitude: 39.9042, timezoneOffset: 8 },
  { name: '上海', province: '上海市', longitude: 121.4737, latitude: 31.2304, timezoneOffset: 8 },
  { name: '广州', province: '广东省', longitude: 113.2644, latitude: 23.1291, timezoneOffset: 8 },
  { name: '深圳', province: '广东省', longitude: 114.0579, latitude: 22.5431, timezoneOffset: 8 },
  { name: '杭州', province: '浙江省', longitude: 120.1551, latitude: 30.2741, timezoneOffset: 8 },
  { name: '成都', province: '四川省', longitude: 104.0665, latitude: 30.5723, timezoneOffset: 8 },
  { name: '重庆', province: '重庆市', longitude: 106.5516, latitude: 29.563, timezoneOffset: 8 },
  { name: '武汉', province: '湖北省', longitude: 114.3054, latitude: 30.5931, timezoneOffset: 8 },
  { name: '西安', province: '陕西省', longitude: 108.9398, latitude: 34.3416, timezoneOffset: 8 },
  { name: '南京', province: '江苏省', longitude: 118.7969, latitude: 32.0603, timezoneOffset: 8 },
  { name: '天津', province: '天津市', longitude: 117.2009, latitude: 39.0842, timezoneOffset: 8 },
  { name: '苏州', province: '江苏省', longitude: 120.5853, latitude: 31.2989, timezoneOffset: 8 },
  { name: '郑州', province: '河南省', longitude: 113.6254, latitude: 34.7466, timezoneOffset: 8 },
  { name: '长沙', province: '湖南省', longitude: 112.9388, latitude: 28.2282, timezoneOffset: 8 },
  { name: '东莞', province: '广东省', longitude: 113.7518, latitude: 23.0207, timezoneOffset: 8 },
  { name: '佛山', province: '广东省', longitude: 113.1214, latitude: 23.0215, timezoneOffset: 8 },
  { name: '沈阳', province: '辽宁省', longitude: 123.4315, latitude: 41.8057, timezoneOffset: 8 },
  { name: '青岛', province: '山东省', longitude: 120.3826, latitude: 36.0671, timezoneOffset: 8 },
  { name: '济南', province: '山东省', longitude: 117.1205, latitude: 36.651, timezoneOffset: 8 },
  {
    name: '哈尔滨',
    province: '黑龙江省',
    longitude: 126.5349,
    latitude: 45.8038,
    timezoneOffset: 8,
  },
  { name: '长春', province: '吉林省', longitude: 125.3236, latitude: 43.8171, timezoneOffset: 8 },
  { name: '大连', province: '辽宁省', longitude: 121.6147, latitude: 38.914, timezoneOffset: 8 },
  { name: '昆明', province: '云南省', longitude: 102.8329, latitude: 24.8801, timezoneOffset: 8 },
  { name: '福州', province: '福建省', longitude: 119.2965, latitude: 26.0745, timezoneOffset: 8 },
  { name: '厦门', province: '福建省', longitude: 118.0894, latitude: 24.4798, timezoneOffset: 8 },
  { name: '合肥', province: '安徽省', longitude: 117.2272, latitude: 31.8206, timezoneOffset: 8 },
  { name: '南昌', province: '江西省', longitude: 115.8582, latitude: 28.6829, timezoneOffset: 8 },
  {
    name: '南宁',
    province: '广西壮族自治区',
    longitude: 108.3669,
    latitude: 22.817,
    timezoneOffset: 8,
  },
  { name: '贵阳', province: '贵州省', longitude: 106.6302, latitude: 26.6477, timezoneOffset: 8 },
  { name: '海口', province: '海南省', longitude: 110.1983, latitude: 20.0444, timezoneOffset: 8 },
  {
    name: '乌鲁木齐',
    province: '新疆维吾尔自治区',
    longitude: 87.6168,
    latitude: 43.8256,
    timezoneOffset: 8,
  },
  { name: '兰州', province: '甘肃省', longitude: 103.8343, latitude: 36.0611, timezoneOffset: 8 },
  { name: '西宁', province: '青海省', longitude: 101.7782, latitude: 36.6171, timezoneOffset: 8 },
  {
    name: '银川',
    province: '宁夏回族自治区',
    longitude: 106.2309,
    latitude: 38.4872,
    timezoneOffset: 8,
  },
  {
    name: '呼和浩特',
    province: '内蒙古自治区',
    longitude: 111.7492,
    latitude: 40.8426,
    timezoneOffset: 8,
  },
  { name: '石家庄', province: '河北省', longitude: 114.5149, latitude: 38.0428, timezoneOffset: 8 },
  { name: '太原', province: '山西省', longitude: 112.5489, latitude: 37.8706, timezoneOffset: 8 },
  {
    name: '拉萨',
    province: '西藏自治区',
    longitude: 91.1409,
    latitude: 29.6456,
    timezoneOffset: 8,
  },
  {
    name: '香港',
    province: '香港特别行政区',
    longitude: 114.1694,
    latitude: 22.3193,
    timezoneOffset: 8,
  },
  {
    name: '澳门',
    province: '澳门特别行政区',
    longitude: 113.5439,
    latitude: 22.1987,
    timezoneOffset: 8,
  },
  { name: '台北', province: '台湾省', longitude: 121.5654, latitude: 25.033, timezoneOffset: 8 },
];

export function searchCities(keyword: string): City[] {
  const k = keyword.trim();
  if (!k) return [];
  return CITIES.filter((c) => c.name.includes(k) || c.province.includes(k)).slice(0, 10);
}

export function findCity(name: string): City | undefined {
  return CITIES.find((c) => c.name === name.trim());
}
