const { writeFileSync } = require('fs');

const createBaseFile = () => `
stages:
  - publish
`;

const createEmptyJob = () => `
publish:empty:
  stage: publish
  script:
    - echo 'no apps affected!'
`;

const createJob = (service) => `
publish:${service}:
  stage: publish
  image: docker
  variables:
    SERVICE: ${service}
    TAG_NAME: $CI_COMMIT_SHORT_SHA
  services:
    - name: docker:dind
      alias: docker
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build --pull --cache-from $CI_REGISTRY_IMAGE --tag $CI_REGISTRY_IMAGE/${service}:$TAG_NAME .
    - docker push $CI_REGISTRY_IMAGE/${service}:$TAG_NAME
`;

const createCIFile = (projects) => {
  if (!projects.length) {
    return createBaseFile().concat(createEmptyJob());
  }

  return createBaseFile().concat(projects.map(createJob).join('\n'));
};

const createDynamicGitLabFile = () => {
  const [stringifiedAffected] = process.argv.slice(2);

  const { projects } = JSON.parse(stringifiedAffected);

  const content = createCIFile(projects);

  writeFileSync('dynamic-gitlab-ci.yml', content);
};

createDynamicGitLabFile();
