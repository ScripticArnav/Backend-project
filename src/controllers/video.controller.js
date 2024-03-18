import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  //TODO: get all videos based on query, sort, pagination
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  // Convert page and limit to numbers
  const pageNum = Number(page);
  const limitNum = Number(limit);

  // Check if page and limit are valid numbers
  if (!Number.isFinite(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page should be a positive integer");
  }
  if (!Number.isFinite(limitNum) || limitNum < 1) {
    throw new ApiError(400, "Video limit should be a positive integer");
  }
  if (!query || !query.trim()) {
    throw new ApiError(400, "Query is required");
  }

  // Check if userId is provided and valid
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Please provide a valid user id");
    }
  }

  // Calculate startIndex based on page and limit
  const startIndex = (pageNum - 1) * limitNum;

  // Perform aggregation with pagination
  const allVideos = await Video.aggregate([
    {
      $match: {
        owner: mongoose.Types.ObjectId(userId),
        isPublished: true,
        title: {
          $regex: new RegExp(query.trim(), "i"),
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerInfo",
      },
    },
    {
      $addFields: {
        ownerInfo: {
          $first: "$ownerInfo",
        },
      },
    },
    {
      $sort: {
        [sortBy]: sortType === "desc" ? -1 : 1,
      },
    },
    {
      $skip: startIndex,
    },
    {
      $limit: limitNum,
    },
    {
      $project: {
        _id: 1,
        title: 1,
        videoFile: 1,
        thumbnail: 1,
        views: 1,
        duration: 1,
        createdAt: 1,
        owner: 1,
        ownerName: "$ownerInfo.fullName",
        ownerAvatar: "$ownerInfo.avatar",
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, allVideos, "All videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  const videoFileLocalPath = req.files?.videoFile[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (
    !title ||
    title.trim() == "" ||
    !description ||
    description.trim() == ""
  ) {
    throw new ApiError(400, "Tilte and description are required fields");
  }
  if (!(videoFileLocalPath && thumbnailLocalPath)) {
    throw new ApiError(400, "no video file or thumbnail detected");
  }

  const videoFile = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!(videoFile && thumbnail)) {
    throw new ApiError(
      500,
      "Something went wrong while uploading the video or thumbnail"
    );
  }

  const user = req.user?._id;

  const videoToUpload = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    title,
    description,
    duration: videoFile.duration,
    owner: user,
  });

  const uploadedVideo = await Video.findbyId(videoToUpload._id);

  if (!uploadedVideo) {
    throw new ApiError(500, "something went wrong while uploading the video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, uploadedVideo, "Video Uploaded successfully"));

  // TODO: get video, upload to cloudinary, create video
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  if (!videoId) {
    throw new ApiError(400, "There is no such video");
  }

  const video = await Video.findbyId(videoId);

  if (!video) {
    throw new ApiError(400, "No video found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video Found and fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const { title, description } = req.body;
  const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "No thumbnail file detected");
  }

  if (!title || !description || !title.trim() || !description.trim()) {
    throw new ApiError(400, "Title and description are required fields");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (req.user?._id.toString() !== video.owner.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  const oldThumbnail = video.thumbnail;
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload the new thumbnail");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: thumbnail.url,
      },
    },
    { new: true }
  );

  if (oldThumbnail) {
    await deleteFromCloudinary(oldThumbnail);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo, "The video is updated successfully")
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
