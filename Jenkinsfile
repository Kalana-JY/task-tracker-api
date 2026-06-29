pipeline {
    agent any

    environment {
        // ghcr.io requires lowercase image names — same fix you already
        // applied in the GitHub Actions version of this pipeline.
        IMAGE_NAME = "ghcr.io/${env.GITHUB_USERNAME}/task-tracker-api"
        IMAGE_TAG  = "${env.BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Test') {
            // Same role as the GitHub Actions test job: spin up a real
            // Postgres for the test run, then tear it down after.
            steps {
                sh '''
                    docker run -d --name test-postgres \
                        -e POSTGRES_USER=postgres \
                        -e POSTGRES_PASSWORD=postgres \
                        -e POSTGRES_DB=taskdb \
                        -p 5433:5432 \
                        postgres:16-alpine

                    # Give Postgres a few seconds to accept connections
                    sleep 5
                '''
                sh '''
                    DB_HOST=localhost \
                    DB_PORT=5433 \
                    DB_USER=postgres \
                    DB_PASSWORD=postgres \
                    DB_NAME=taskdb \
                    npm test
                '''
            }
            post {
                // Always clean up the test container, whether tests
                // passed or failed, so it doesn't pile up between runs.
                always {
                    sh 'docker rm -f test-postgres || true'
                }
            }
        }

        stage('Build Image') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Push Image') {
            steps {
                // GH_TOKEN/GH_USER come from the Jenkins credential
                // configured in the job (see setup steps in chat).
                withCredentials([usernamePassword(
                    credentialsId: 'ghcr-credentials',
                    usernameVariable: 'GH_USER',
                    passwordVariable: 'GH_TOKEN'
                )]) {
                    sh '''
                        echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin
                        docker push ${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${IMAGE_NAME}:latest
                    '''
                }
            }
        }
    }

    post {
        always {
            // Avoid filling up EC2's small free-tier disk with old images
            sh 'docker image prune -f || true'
        }
        success {
            echo "Pipeline succeeded: ${IMAGE_NAME}:${IMAGE_TAG} pushed to ghcr.io"
        }
        failure {
            echo "Pipeline failed — check the stage logs above."
        }
    }
}
