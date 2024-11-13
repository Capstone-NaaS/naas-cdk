import { ScanCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const db = new DynamoDBClient();
const dynamoDb = DynamoDBDocumentClient.from(db);

const addUserPreferences = async (user_id: string) => {
  const putParams = {
    TableName: process.env.USERPREFS,
    Item: {
      user_id,
      email: true,
      in_app: true,
    },
  };

  try {
    const response = await dynamoDb.send(new PutCommand(putParams));
    const responseStatus = response.$metadata.httpStatusCode;

    if (responseStatus === 200) {
      return {
        statusCode: 200,
        body: "User preferences added",
      };
    } else {
      return {
        statusCode: responseStatus,
        body: "Error adding user preferences",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error adding user preferences",
    };
  }
};

const addUser = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { id, name, email } = JSON.parse(event.body!);

  const putParams = {
    TableName: process.env.USERDB,
    Item: {
      id,
      name,
      email,
      created_at: new Date().toISOString(),
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
        body: "Could not add user: id already exists",
      };
    } else {
      const response = await dynamoDb.send(new PutCommand(putParams));
      const responseStatus = response.$metadata.httpStatusCode;

      if (responseStatus === 200) {
        const prefResponse = await addUserPreferences(id);
        const prefResponseStatus = prefResponse.statusCode;

        if (prefResponseStatus === 200) {
          return {
            statusCode: 200,
            body: "User added",
          };
        } else {
          return {
            statusCode: prefResponseStatus,
            body: "Error adding user preferences",
          };
        }
      } else {
        return {
          statusCode: responseStatus,
          body: "Error creating user",
        };
      }
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error creating user",
    };
  }
};

const deleteUserPreferences = async (user_id: string) => {
  const params = {
    TableName: process.env.USERPREFS,
    Key: {
      user_id,
    },
  };

  try {
    const response = await dynamoDb.send(new DeleteCommand(params));
    const responseStatus = response.$metadata.httpStatusCode;

    if (responseStatus === 200) {
      return {
        statusCode: 200,
        body: "User preferences deleted",
      };
    } else {
      return {
        statusCode: 500,
        body: "Error deleting user preferences",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error deleting user preferences",
    };
  }
};

const deleteUser = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { id } = JSON.parse(event.body!);

  const params = {
    TableName: process.env.USERDB,
    Key: {
      id,
    },
  };

  try {
    const data = await dynamoDb.send(new GetCommand(params));
    if (data.Item) {
      const response = await dynamoDb.send(new DeleteCommand(params));
      const responseStatus = response.$metadata.httpStatusCode;

      if (responseStatus === 200) {
        const prefResponse = await deleteUserPreferences(id);
        const prefResponseStatus = prefResponse.statusCode;

        if (prefResponseStatus === 200) {
          return {
            statusCode: 200,
            body: "User deleted",
          };
        } else {
          return {
            statusCode: prefResponseStatus,
            body: "Error deleting user preferences",
          };
        }
      } else {
        return {
          statusCode: responseStatus,
          body: "Error deleting user",
        };
      }
    } else {
      return {
        statusCode: 404,
        body: "User does not exist",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error deleting user",
    };
  }
};

const editUser = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const { id, name, email } = JSON.parse(event.body!);

  const getParams = {
    TableName: process.env.USERDB,
    Key: {
      id,
    },
  };

  // preserve attributes not being edited
  let oldUserAttributes;

  try {
    const data = await dynamoDb.send(new GetCommand(getParams));
    if (data.Item) {
      oldUserAttributes = data.Item;
    } else {
      return {
        statusCode: 404,
        body: "User does not exist",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error getting user",
    };
  }

  const putParams = {
    TableName: process.env.USERDB,
    Item: oldUserAttributes,
  };

  if (name) {
    putParams.Item.name = name;
  }

  if (email) {
    putParams.Item.email = email;
  }

  try {
    const response = await dynamoDb.send(new PutCommand(putParams));
    const responseStatus = response.$metadata.httpStatusCode;

    if (responseStatus === 200) {
      return {
        statusCode: 200,
        body: "User edited",
      };
    } else {
      return {
        statusCode: responseStatus,
        body: "Error",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error creating user",
    };
  }
};

const getUserPreference = async (user_id: string) => {
  const params = {
    TableName: process.env.USERPREFS,
    Key: {
      user_id,
    },
  };

  try {
    const data = await dynamoDb.send(new GetCommand(params));
    return data.Item;
  } catch (error) {
    console.error("Error getting user preferences:", error);
  }
};

const getUser = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const id = event.pathParameters!.userId!;

  const params = {
    TableName: process.env.USERDB,
    Key: {
      id,
    },
  };

  try {
    const data = await dynamoDb.send(new GetCommand(params));
    if (data.Item) {
      data.Item.preferences = await getUserPreference(id);
      delete data.Item.preferences.user_id;

      return {
        statusCode: 200,
        body: JSON.stringify(data.Item),
      };
    } else {
      return {
        statusCode: 404,
        body: "User does not exist",
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error getting user",
    };
  }
};

const getUserPreferences = async () => {
  const params = {
    TableName: process.env.USERPREFS,
  };

  try {
    const data = await dynamoDb.send(new ScanCommand(params));
    return data.Items?.map((item) => unmarshall(item));
  } catch (error) {
    console.error("Error getting user preferences:", error);
  }
};

const getAllUsers = async (): Promise<APIGatewayProxyResultV2> => {
  const params = {
    TableName: process.env.USERDB,
  };

  try {
    const data = await dynamoDb.send(new ScanCommand(params));
    let users = data.Items?.map((item) => unmarshall(item));
    let preferences = await getUserPreferences();

    users!.forEach((user) => {
      user.preferences = preferences!
        .filter((p) => p.user_id === user.id)
        .slice()[0];
      delete user.preferences.user_id;
    });

    return {
      statusCode: 200,
      body: JSON.stringify(users),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: "Error getting users",
    };
  }
};

exports.handler = async (event: APIGatewayProxyEventV2) => {
  switch (event.requestContext.http.method) {
    case "GET":
      if (event.rawPath.endsWith("users")) {
        return await getAllUsers();
      } else {
        return await getUser(event);
      }
    case "POST":
      return await addUser(event);
    case "DELETE":
      return await deleteUser(event);
    case "PUT":
      return await editUser(event);
    default:
      return {
        statusCode: 404,
        body: "Route not found",
      };
  }
};
