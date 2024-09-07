import * as cdk from 'aws-cdk-lib'
import { Stack, StackProps } from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { RemovalPolicy } from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * Terraform S3 Backend Deployment
 * https://developer.hashicorp.com/terraform/language/settings/backends/s3
 */
export class TerraformBackendStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: StackProps,
    appName = 'terraform-backend'
  ) {
    super(scope, id, props)

    const accountId = cdk.Stack.of(this).account

    const defaultBucketName = `${appName}-state-storage-${accountId}`
    const defaultDynamoDBTableName = `${appName}-state-lock-${accountId}`

    // https://developer.hashicorp.com/terraform/language/state
    const terraformStateBucket = new s3.Bucket(this, 'TerraformStateStorage', {
      bucketName: defaultBucketName,
      versioned: true, // Enable versioning
      removalPolicy: RemovalPolicy.RETAIN, // Prevent destroy
      encryption: s3.BucketEncryption.S3_MANAGED, // Enable server-side encryption
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      lifecycleRules: [
        {
          id: 'AutoAbortFailedMultipartUpload',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(10),
        },
      ],
      enforceSSL: true,
    })

    // https://developer.hashicorp.com/terraform/language/state/locking
    const terraformLockTable = new dynamodb.Table(this, 'TerraformStateLock', {
      tableName: defaultDynamoDBTableName,
      partitionKey: { name: 'LockID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN, // Retain the table when the stack is deleted
      pointInTimeRecovery: true, // Enable Point-In-Time Recovery
      deletionProtection: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    })

    // Outputs
    new cdk.CfnOutput(this, 'S3Bucket', {
      value: terraformStateBucket.bucketArn,
      description: 'The ARN of the S3 bucket used for Terraform state storage',
      exportName: `${appName}-bucket-arn`,
    })

    new cdk.CfnOutput(this, 'DynamoDBTable', {
      value: terraformLockTable.tableArn,
      description:
        'The ARN of the DynamoDB table used for Terraform state locking',
      exportName: `${appName}-table-arn`,
    })
  }
}
