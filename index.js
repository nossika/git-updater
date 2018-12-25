const path = require('path');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const child_process = require('child_process');
const crypto = require('crypto');
const config = require('./config');

const app = new Koa();

app.use(bodyParser());

async function exec(cmd, options = {}, flag) {
  if (typeof options === 'number') {
    flag = options;
    options = {};
  }
  return new Promise((resolve, reject) => {
    child_process.exec(cmd, options, (err, stdout) => {
      if (err) {
        reject(flag);
        return;
      }
      resolve(stdout);
    });
  });
}

app.use(async ctx => {

  if (
    // 手动构造header里带x-key的请求来触发
    ctx.request.headers['x-key'] !== config.key &&
    // 通过git配置的webhooks事件来触发
    ctx.request.headers['x-hub-signature'] !== `sha1=${crypto.createHmac('SHA1', config.key).update(ctx.request.rawBody).digest('hex')}`
  ) {
    ctx.response.status = 401;
    ctx.body = { msg: 'unauthorized' };
    return;
  }

  const body = ctx.request.body;
  
  let data = '';

  if (body.ref !== `refs/heads/${config.branch}`) {
    ctx.body = { data, msg: 'ignored' };
    return;
  }

  try {
    // ctx.request.URL.pathname对应项目目录名，比如请求 http://127.0.0.1:10000/project1 则表示到相对路径下的project1这个目录下执行pull操作
    // 默认的相对路径为git-updater这个包所在的目录，可在config中的projectPath修改
    await exec(`cd ${path.resolve(__dirname, '..', config.projectPath, `${ctx.request.URL.pathname.replace(/^[\/\\]/g, '')}`)}`, 'path');
    data = await exec(`git pull origin ${config.branch}`, { cwd: path.resolve(__dirname, `..${ctx.request.URL.pathname}`) }, 'pull');
  } catch (err) {
    switch (err) {
      case 'path':
        ctx.response.status = 403;
        ctx.body = { msg: 'path error' };
        break;
      case 'pull':
        ctx.response.status = 500;
        ctx.body = { msg: 'pull fail' };
        break;
      default:
        ctx.response.status = 500;
        ctx.body = { msg: 'fail' };
    }
    return;
  }

  ctx.body = { data, msg: 'ok' };
  
});

const argv = process.argv.slice(2);
const port = +argv[0] ? +argv[0] : 10000;

app.listen(port, () => {
  console.log('listen at ' + port);
});
