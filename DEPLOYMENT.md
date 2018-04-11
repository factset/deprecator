# Deployment

Guide for deploying `deprecator` to a Heroku-like environment.

As you will see below, the App portion of `deprecator` only works for GitHub. GitLab is not supported. However, we would accept GitLab support if you are willing to contribute the work.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Environment Variables](#environment-variables)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Environment Variables

**DEBUG**

> Optional.

Setting `DEBUG` to `deprecator` will print all debug statements available in the `deprecator` package.

**DRY_RUN**

> Optional.

Setting `DRY_RUN` to `true` will cause `deprecator` to go through the deprecation process, including returning deprecation information, but it won't actually deprecate a package. Dry run mode makes it easy to see that `deprecator` is deprecating those packages, and versions, you expect, without any consequences. Then, when your confident of your results, you can remove the environment variable and `deprecator` will begin deprecating packages.

**GITHUB_APPLICATION_ID**

The _App ID_ listed on your GitHub App configuration page after the [_Creating a GitHub App_](https://developer.github.com/apps/building-github-apps/creating-a-github-app/) process.

**GITHUB_APPLICATION_KEY**

The contents of the `PEM` file generated as part of the [_Generating a private key_](https://developer.github.com/apps/building-github-apps/authentication-options-for-github-apps/#generating-a-private-key) process.

**GITHUB_ENDPOINT**

The fully qualified domain of your GitHub installation's API.

For GitHub.com, that would be `https://api.github.com`.

**REDIS_URL**

A fully qualified URL containing the connection parameters for a REDIS database in the form created by the [Heroku Redis add-on](https://devcenter.heroku.com/articles/heroku-redis) and supported by the [Redis client for Node](https://github.com/NodeRedis/node_redis#rediscreateclient).

**RULES**

A string encoded JSON object of rules that should be used by `deprecator` to deprecate packages fetched by the `deprecator` service.

As an example (enabling the `all` rule):

```bash
RULES='{"all": null}'
```

**WEB_CONCURRENCY**

The number of server processes that should be spawned within each _web_ container.

**WORKER_CONCURRENCY**

The number of worker processes that should be spawned within each _worker_ container.
