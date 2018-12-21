/**
 * @auth yangyufei
 * @date 2018-12-12 17:34:56
 * @desc
 */
const fetcher = require('./fetcher');
const fs = require('fs');

// fetcher.getAnnCount().then(data => {
//     console.log(JSON.stringify(data, null, 4))
// });

// fetcher.getNaviData(1, 1, 1000).then(data => {
//     fs.writeFileSync('d://getNaviData.json', JSON.stringify(data, null, 4));
// });

// fetcher.getJobList('java', 719, 1).then(data => {
//     console.log(data)
// });

// fetcher.getJobInfo('CZ314334410J00102035313').then(console.log);

fetcher.getCorpInfo('CZ607894330').then(console.log);

// fetcher.getCityList().then(console.log);

// fetcher.getJobCategories().then(data => {
//     fs.writeFileSync('d://cate.json', JSON.stringify(data, null, 4));
// });