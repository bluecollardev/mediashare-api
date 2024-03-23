const { writeFileSync } = require('fs');

const createBaseFile = () =>
  `stages:
  - publish
`;

const createEmptyJob = () => `
publish:empty:
  stage: publish
  script:
    - echo 'no apps affected!'
`;

const createJob = (service, env) => `
publish:${service}:
  stage: publish
  image: docker
  variables:
    SERVICE: ${service}-dev
    TAG_NAME: $CI_COMMIT_SHORT_SHA
  services:
    - name: docker:dind
      alias: docker
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build --pull --cache-from $CI_REGISTRY_IMAGE --tag $CI_REGISTRY_IMAGE/${
      env === 'dev' ? service + '-dev' : service
    }:$TAG_NAME .
    - docker push $CI_REGISTRY_IMAGE/${service}-dev:$TAG_NAME
`;

const createCIFile = (services, env) => {
  if (!services.length) {
    return createBaseFile().concat(createEmptyJob());
  }

  return createBaseFile().concat(
    services.map((service) => createJob(service, env)).join('\n')
  );
};

const createDynamicGitLabFile = () => {
  const args = process.argv.slice(2, 4);
  const [projects, env] = args;
  const content = createCIFile(JSON.parse(projects), env);

  writeFileSync('dynamic-gitlab-ci.yml', content);
};

createDynamicGitLabFile();
