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
        reject({
          info: err,
          flag,
        });
        return;
      }
      resolve(stdout);
    });
  });
}

app.use(async ctx => {

  if (
    // 手动构造header里带x-key的请求来mock触发
    ctx.request.headers['x-key'] !== config.key &&
    // 通过git配置的webhooks事件来正常触发
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
    // 默认的相对路径为git-updater这个包所在的目录，可在config中的basePath修改
    const projectName = ctx.request.URL.pathname.replace(/^[\/\\]/g, '');
    const cwd = path.resolve(__dirname, `..${ctx.request.URL.pathname}`);
    await exec(`cd ${path.resolve(__dirname, '..', config.basePath, projectName)}`, 'check path');
    data = await exec(`git pull origin ${config.branch}`, { cwd }, 'git pull');

    if (config.cmd && config.cmd[projectName]) {
      let cmds = config.cmd[projectName];
      if (typeof cmds === 'string') {
        cmds = [cmds];
      }

      // 耗时较长，返回请求时不再await cmd日志
      setTimeout(() => {
        for (let i = 0; i < cmds.length; i++) {
          exec(cmds[i], { cwd }, `exec ${cmds[i]}`);
        }
      });
 
    }

  } catch (err) {
    switch (err.flag) {
      case 'check path':
        ctx.response.status = 403;
        ctx.body = { msg: 'path wrong' };
        break;
      case 'git pull':
        ctx.response.status = 500;
        ctx.body = { msg: 'pull fail' };
        break;
      default:
        ctx.response.status = 500;
        ctx.body = { msg: err.flag || 'fail', err: err.info || String(err) };
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
