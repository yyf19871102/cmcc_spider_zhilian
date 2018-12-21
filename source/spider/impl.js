/**
 * @auth yangyufei
 * @date 2018-12-19 15:10:12
 * @desc
 */
const moment        = require('moment');
const _             = require('lodash');

const phaseManager  = require('../core/phase');
const fetcher       = require('./fetcher');
const SysConf       = require('../config');
const cateList      = require('./cate.json');

exports.makeMacroTasks = async () => {
    return [
        {code : '599', name: '沈阳'},
        // {code : '600', name: '大连'},
        // {code : '601', name: '鞍山'},
        // {code : '602', name: '抚顺'},
        // {code : '603', name: '本溪'},
        // {code : '604', name: '丹东'},
        // {code : '605', name: '锦州'},
        // {code : '606', name: '营口'},
        // {code : '607', name: '阜新'},
        // {code : '608', name: '辽阳'},
        // {code : '609', name: '盘锦'},
        // {code : '610', name: '铁岭'},
        // {code : '611', name: '朝阳'},
        // {code : '612', name: '葫芦岛'},
    ];
};

exports.makePhaseList = async (context) => {
	let {corpFilter} = context.filterManager;
	let {corpOut, jobOut} = context.outputManager;

	let phaseList = [];

	let phaseMakeBaseParams = await phaseManager.getOnePhase('makeBaseParams', 1);
	let phaseGetJobNaviPages = await phaseManager.getOnePhase('getJobNaviPages', 2, null, 8, 20);
	let phaseGetJobList = await phaseManager.getOnePhase('getJobNaviList', 3, null, 8, 20);
	let phaseGetJobInfo = await phaseManager.getOnePhase('getJobInfo', 4);
	let phaseGetCorpInfo = await phaseManager.getOnePhase('getCorpInfo', 5);

    phaseMakeBaseParams.setHandler(async cityObj => {
        let paramsList = [];

        cateList.forEach(cate => {
            paramsList.push(_.merge({}, cate, cityObj));
        });

        await phaseGetJobNaviPages.insertTasks(paramsList);
    });

    phaseGetJobNaviPages.setHandler(async param => {
        let {totalPage, jobList, corpList} = await fetcher.getJobList(param.cateLv2, param.code, 1);

        await phaseGetJobInfo.insertTasks(jobList.map(job => {
            job.cateLv1 = param.cateLv1;
            job.cateLv2 = param.cateLv2;

            return job;
        }));

        let _corpList = [];
        for (let corp of corpList) {
            !await corpFilter.exists(corp.corpId) && _corpList.push(corp);
        }
        await phaseGetCorpInfo.insertTasks(_corpList);

        let pageList = [];
        for (let page = 2; page <= totalPage; page++) {
            pageList.push(_.merge({}, param, {page}));
        }
        await phaseGetJobList.insertTasks(pageList);
    });

    phaseGetJobList.setHandler(async param => {
        let {totalPage, jobList, corpList} = await fetcher.getJobList(param.cateLv2, param.code, param.page);

        await phaseGetJobInfo.insertTasks(jobList.map(job => {
            job.cateLv1 = param.cateLv1;
            job.cateLv2 = param.cateLv2;

            return job;
        }));

        let _corpList = [];
        for (let corp of corpList) {
            !await corpFilter.exists(corp.corpId) && _corpList.push(corp);
        }
        await phaseGetCorpInfo.insertTasks(_corpList);
    });

    phaseGetJobInfo.setHandler(async job => {
        let jobInfo = await fetcher.getJobInfo(job.jobId);

        jobInfo.jobId = job.jobId;
        jobInfo.companyId = job.corpId;
        jobInfo.cateLv1 = job.cateLv1;
        jobInfo.cateLv2 = job.cateLv2;

        await jobOut.write([jobInfo]);
    });

    phaseGetCorpInfo.setHandler(async corp => {
        let corpInfo = await fetcher.getCorpInfo(corp.corpId);
        corpInfo.companyId = corp.corpId;

        await corpOut.write([corpInfo]);
    });

    return [phaseMakeBaseParams, phaseGetJobNaviPages, phaseGetJobList, phaseGetJobInfo, phaseGetCorpInfo];
};