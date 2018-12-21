/**
 * @author yangyufei
 * @date 2018-12-15 10:22:16
 * @desc
 */
const cheerio           = require('cheerio');

const {requestUrl}      = require('../core/utils');
const SysConf           = require('../config');
const {timeout, retry}  = SysConf.SPIDER.fetch;
const provinceService   = require('../common/province');

const JOB_NAVI_SIZE     = 100; // 岗位的导航页最多100条数据

/**
 * 获取城市信息
 * @returns {Promise<Array>}
 */
exports.getCityList = async () => {
    let reqConf = {
        uri     : 'https://www.zhaopin.com/citymap',
        method  : 'GET',
    };

    let htmlStr = await requestUrl(reqConf, null, res => /__INITIAL_STATE__=/.test(res));
    let dataStr = /__INITIAL_STATE__=(.*)}<\/script>/.exec(htmlStr)[1];
    let cityInfo = JSON.parse(dataStr + '}');

    let cityList = [];
    for (let word in cityInfo.cityList.cityMapList) {
        let wordCityList = cityInfo.cityList.cityMapList[word];

        wordCityList.forEach(city => {
            let province = provinceService.getProvinceByCityName(city.name);

            city.province = province;
            !/jl/.test(city.url) && cityList.push(city);
        });
    }

    return cityList;
};

/**
 * 获取岗位分类：cateLv1是大分类；cateLv2是小分类；
 * @returns {Promise<Array>}
 */
exports.getJobCategories = async () => {
    let reqConf = {
        uri     : 'https://www.zhaopin.com/',
        method  : 'GET',
        transform: res => cheerio.load(res)
    };

    let $ = await requestUrl(reqConf, null, $ => $('.zp-jobNavigater__pop--container').length > 0);

    let cateList = [];

    $('.zp-jobNavigater__pop--container').each(function () {
        let cateLv1 = $(this).find('.zp-jobNavigater__pop--title').text().replace(/\s/g, '');
        $(this).find('.zp-jobNavigater__pop--href').each(function () {
            let cateLv2 = $(this).text().replace(/\s/g, '');

            cateList.push({cateLv1, cateLv2});
        })
    });

    return cateList;
};

/**
 * 根据关键字和城市code获取数据
 * @param keyword
 * @param cityCode
 * @param page
 * @returns {Promise<*>}
 */
exports.getJobList = async (keyword, cityCode, page) => {
    let reqConf = {
        uri     : 'https://fe-api.zhaopin.com/c/i/sou',
        method  : 'GET',
        useProxy: true,
        json    : true,
        qs      : {
            start   : (page - 1) * JOB_NAVI_SIZE,
            pageSize: JOB_NAVI_SIZE,
            cityId  : cityCode,
            workExperience: -1,
            education: -1,
            companyType: -1,
            employmentType: -1,
            jobWelfareTag: -1,
            kw      : keyword,
            kt      : 3,
        }
    };

    let data = await requestUrl(reqConf, 1, res => res.code === 200);

    let totalPage = Math.ceil(data.data.numFound / JOB_NAVI_SIZE);
    let jobList = [], corpList = [];
    data.data.results.forEach(record => {
        let jobId = record.number;
        let corpId = record.company.number;

        jobList.push({jobId, corpId});
        corpList.push({corpId});
    });
    return {totalPage, jobList, corpList};
};

/**
 * 获取职位信息
 * @param jobId
 * @returns {Promise<{title: string, money: string, city: string, workExp: string, educationLevel: string, desc: string, welfare: string, workAt: string}>}
 */
exports.getJobInfo = async (jobId) => {
    let reqConf = {
        uri     : `https://jobs.zhaopin.com/${jobId}.htm`,
        method  : 'GET',
        transform: res => cheerio.load(res),
        useProxy: true
    };

    let $ = await requestUrl(reqConf, null, $ => $('.main').length > 0);

    let job = {
        title   : '',
        money   : '',
        city    : '',
        workExp : '',
        educationLevel: '',
        desc    : '',
        welfare : '',
        workAt  : ''
    };

    let ele = $('.main > .main1.main1-stat > .new-info');
    if (ele.length > 0) {
        ele.find('.info-h3').length > 0 && (job.title = ele.find('.info-h3').text().replace(/\s/g, ''));
        ele.find('.info-money').length > 0 && (job.money = ele.find('.info-money').text().replace(/\s|元\/月/g, ''));

        if (ele.find('.info-three').length > 0) {
            ele.find('.info-three span').each(function(index) {
                let value = $(this).text().replace(/\s/g, '');

                switch(index) {
                    case 0: job.city = value; break;
                    case 1: job.workExp = value; break;
                    case 2: job.educationLevel = value; break;
                    case 3: job.desc = `${value}@`; break;
                }
            })
        }
    }

    $('.pos-info-tit').each(function (index) {
        if (index === 0) {
            $(this).find('div span').each(function () {
                job.welfare += `${$(this).text().replace(/\s/g, '')},`;
            })
        }
    });

    ele = $('.responsibility.pos-common');
    ele.length > 0 && (job.desc += ele.text().replace(/\s/g, ''));

    ele = $('.add-txt');
    ele.length > 0 && (job.workAt = ele.text().replace(/\s/g, ''));

    return job;
};

/**
 * 根据公司ID获取公司
 * @param corpId
 * @returns {Promise<{address: *, companySize: *, companyTelephone: *, companyType: (number|*), companyUrl: *, description: *, industries: *, title: *}>}
 */
exports.getCorpInfo = async corpId => {
    let reqConf = {
        uri     : `https://company.zhaopin.com/${corpId}.htm`,
        method  : 'GET',
        useProxy: true,
    };

    let htmlStr = await requestUrl(reqConf, null, res => /__INITIAL_STATE__=/.test(res));
    let descStr = /"description":"(.*)","industries"/.exec(htmlStr)[1];

    let dataStr = /__INITIAL_STATE__=(.*)}<\/script>/.exec(htmlStr.replace(/"description":"(.*)","industries"/, '"description":"","industries"'))[1];
    let corpInfo = JSON.parse(dataStr + '}');

    let corp = {
        address     : corpInfo.company.address,
        companySize : corpInfo.company.companySize,
        companyTelephone: corpInfo.company.companyTelephone,
        companyType : corpInfo.company.companyType,
        companyUrl  : corpInfo.company.companyUrl,
        description : cheerio.load(descStr).text(),
        industries  : corpInfo.company.industries.join(),
        title       : corpInfo.company.title,
    };

    return corp;
};