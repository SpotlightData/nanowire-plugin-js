@Library('PipelineHelpers') _

pipeline {
    agent any

    environment {
        TESTING_COMMAND = "npm test"
    }

    stages {
        stage('Test') {
            steps {
                script {
                    ws('/tmp/ls') {
                        checkout scm

                        docker.image('node:8-alpine').inside("-u 0:0") {
                            sshagent(credentials: ['bitbucket-ssh']) {
                                sh 'apk add --update git openssh-client'
                                sh 'mkdir -p ~/.ssh && touch ~/.ssh/config && echo -e "StrictHostKeyChecking=no\nUserKnownHostsFile=/dev/null" >> ~/.ssh/config'
                                sh 'npm install --dev'
                                sh 'npm test'
                            }
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            script {
                pipelineHelpers.notifySlack(currentBuild)
            }
        }
    }
}