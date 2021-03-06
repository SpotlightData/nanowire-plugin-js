const config = {
  ES_INDEX: process.env.ES_INDEX || 'pipeline',
  ES_TYPE: process.env.ES_TYPE || 'task',
  ES_GROUP_INDEX: process.env.ES_GROUP_INDEX || 'group',
  ES_GROUP_TYPE_GROUP: process.env.ES_GROUP_TYPE_GROUP || 'groupResults',
  ES_GROUP_TYPE_TASK: process.env.ES_GROUP_TYPE_TASK || 'taskResults',
};

module.exports = config;

export default config;
