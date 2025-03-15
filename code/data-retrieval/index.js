// index.js
const {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command
} = require('@aws-sdk/client-s3')

const s3Client = new S3Client({
  region: process.env.AWS_REGION
})

// Convert stream to string
const streamToString = stream => {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}

// Get most recent date directory
const getMostRecentDate = async bucketName => {
  const prefix = 'nba-stats/'
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: '/'
    })
  )

  if (!response.CommonPrefixes?.length) {
    throw new Error('No data directories found')
  }

  // Get and sort date directories
  const dateDirs = response.CommonPrefixes.map(
    prefix => prefix.Prefix.replace(prefix, '').split('/')[1]
  )
    .filter(dir => /^\d{4}-\d{2}-\d{2}$/.test(dir))
    .sort()
    .reverse()

  if (!dateDirs.length) throw new Error('No valid date directories found')
  return dateDirs[0]
}

// Format HTTP response
const formatResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*' // enable CORS
  },
  body: JSON.stringify(body)
})

/**
 * Retrieves NBA team stats data from S3
 * @param {Object} options - Options for data retrieval
 * @returns {Promise<Object>} - The retrieved data and metadata
 */
const getNbaData = async options => {
  const { bucketName, date, teamName, sortBy, ascending = true } = options

  if (!bucketName) {
    throw new Error('Bucket name is required')
  }

  try {
    const retrievalDate = date || (await getMostRecentDate(bucketName))
    const key = `nba-stats/${retrievalDate}/data.json`

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    })

    const response = await s3Client.send(getCommand)
    let data = JSON.parse(await streamToString(response.Body)).data

    // Filter by team if needed
    if (teamName) {
      data = data.filter(item =>
        item.attributes.Team?.toLowerCase().includes(teamName.toLowerCase())
      )
    }

    // Sort if needed
    if (sortBy && data[0]?.attributes[sortBy] !== undefined) {
      data.sort()
    }

    return {
      statusCode: 200,
      body: {
        data: processedData
      }
    }
  } catch (error) {
    console.error('Retrival error:', error)
    return formatResponse(500, {
      error: 'Failed to retrieve data',
      message: error.message
    })
  }
}

// lambda handler
export const handler = async event => {
  console.log('Event received:', JSON.stringify(event))

  try {
    const params = event.queryStringParameters || {}

    const options = {
      bucketName: process.env.S3_BUCKET_NAME,
      date: params.date,
      teamName: params.team,
      sortBy: params.sortBy,
      ascending: params.order?.toLowerCase() !== 'desc'
    }

    // Validate bucket name
    if (!options.bucketName) {
      return formatResponse(400, {
        error: 'Configuration error',
        message: 'S3 bucket name is not configured'
      })
    }

    // Validate date format if provided
    if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      return formatResponse(400, {
        error: 'Invalid parameter',
        message: 'Date must be in YYYY-MM-DD format'
      })
    }

    const result = await getNbaData(options)
    return formatResponse(result.statusCode, result.body)
  } catch (error) {
    console.error('Handler error:', error)
    return formatResponse(500, {
      error: 'Failed to process request',
      message: error.message
    })
  }
}
