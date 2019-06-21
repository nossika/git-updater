module.exports = {
  basePath: '', // the base path to your projects, '' => '/path/to/git-updater/../'
  branch: 'master', // target branch
  key: 'nossika', // your git webhook secret
  cmd: { // build cmds for your project
    'FE-guide': ['npm run build'],
  },
};
