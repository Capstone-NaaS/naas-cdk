const { ScanCommand, DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const db = new DynamoDBClient();
const dynamoDb = DynamoDBDocumentClient.from(db);

const addUser = async (event) => {
  const { id, name, email, userHash } = JSON.parse(event.body);

  const putParams = {
    TableName: process.env.USERDB,
    Item: {
      id,
      name,
      email,
      userHash
    },
  };

  const getParams = {
    TableName: process.env.USERDB,
    Key: {
      id,
    },
  };

  try {
    const data = await dynamoDb.send(new GetCommand(getParams));
    if (data.Item) {
      return {
        statusCode: 400,
        body: "Could not add user: id already exists"
      };
    } else {
      const response = await dynamoDb.send(new PutCommand(putParams));
      const responseStatus = response.$metadata.httpStatusCode;

      if (responseStatus === 200) {
        return {
          statusCode: 200,
          body: "User added"
        };
      } else {
        return {
          statusCode: responseStatus,
          body: "Error"
        }
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error creating user"
    };
  }
}

const deleteUser = async (event) => {
  const { id } = JSON.parse(event.body);

  const params = {
    TableName: process.env.USERDB,
    Key: {
      id
    },
  };

  try {
    const data = await dynamoDb.send(new GetCommand(params));
    if (data.Item) {
      const response = await dynamoDb.send(new DeleteCommand(params));
      const responseStatus = response.$metadata.httpStatusCode;

      if (responseStatus === 200) {
        return {
          statusCode: 200,
          body: "User deleted"
        };
      } else {
        return {
          statusCode: responseStatus,
          body: "Error"
        }
      }
    } else {
      return {
        statusCode: 400,
        body: "User does not exist"
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error deleting user"
    };
  }
}

const editUser = async (event) => {
  const { id, name, email, userHash } = JSON.parse(event.body);

  const params = {
    TableName: process.env.USERDB,
    Item: {
      id,
      name,
      email,
      userHash
    },
  };

  try {
    const response = await dynamoDb.send(new PutCommand(params));
    const responseStatus = response.$metadata.httpStatusCode;

    if (responseStatus === 200) {
      return {
        statusCode: 200,
        body: "User edited"
      };
    } else {
      return {
        statusCode: responseStatus,
        body: "Error"
      }
    }

  } catch (error) {
    return {
      statusCode: 500,
      body: "Error creating user"
    };
  }
}

const getUser = async (event) => {
  const id = event.pathParameters.userId;

  const params = {
    TableName: process.env.USERDB,
    Key: {
      id,
    },
  };

  try {
    const data = await dynamoDb.send(new GetCommand(params));
    if (data.Item) {
      return {
        statusCode: 200,
        body: JSON.stringify(data.Item)
      };
    } else {
      return {
        statusCode: 400,
        body: "User does not exist"
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error getting user"
    };
  }
}

const getAllUsers = async (event) => {
  const params = {
    TableName: process.env.USERDB,
  };

  try {
    const data = await dynamoDb.send(new ScanCommand(params));
    return {
      statusCode: 200,
      body: JSON.stringify(data.Items.map(item => unmarshall(item)))
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error getting users"
    };
  }
}

exports.handler = async (event, context) => {
  switch (event.requestContext.http.method) {
    case "GET":
      if (event.rawPath.endsWith('users')) {
        return await getAllUsers(event);
      } else {
        return await getUser(event);
      }
    case "POST":
      return await addUser(event);
    case "DELETE":
      return await deleteUser(event);
    case "PUT":
      return await editUser(event);
  }
};
